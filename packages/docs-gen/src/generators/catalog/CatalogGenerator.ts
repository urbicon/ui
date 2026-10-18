import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  ComponentCatalogEntry,
  ComponentCatalogPropDoc
} from '@urbicon-ui/design-engine/search';
import { noJsDocDescription } from '../../extractors/typescript/TypeScriptBaseExtractor';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../../types';
import { toSlug } from '../../utils/slug';
import { resolveSlotNames } from '../shared/slots';

// The schema is design-engine's: the type `urbicon find` and `get-component`
// read the catalog with, so what is written here is checked against it.
export type {
  ComponentCatalog,
  ComponentCatalogEntry,
  ComponentCatalogPropDoc,
  RecipeEntry
} from '@urbicon-ui/design-engine/search';

/**
 * The `@urbicon-ui/docs` components: the furniture documentation pages are
 * built FROM, not building blocks for a consumer's UI. `CatalogAssembler`
 * keeps them out of the assembled catalog — `urbicon find` answers "what do
 * I build this UI from", and a PlaygroundConfigurator is never that answer.
 * Their per-package `_catalog.json` is still written (it is what
 * `summary:lint` and the docs site's own index read), but without the
 * search-only fields (`propDocs`, `valueDescriptions`): that file is imported
 * client-side by the docs index page, which reads name, slug, summary and
 * description.
 *
 * The rule is the package, not a list of names. A hand-kept list of the nine
 * components was the first version and it lasted one new component: `NoteList`
 * was added, nobody remembered the list, and it shipped into the public
 * catalog. Package membership is the actual criterion, so it is the one
 * encoded here — once, for the generator and the assembler.
 */
export const INTERNAL_PACKAGE = '@urbicon-ui/docs';

/**
 * Package → origin tag. Components from these packages carry an extra discovery
 * tag (alongside their functional tag) so the whole surface is filterable in one
 * query, e.g. `urbicon find --tag auth`.
 */
const ORIGIN_TAGS: Record<string, string> = {
  '@urbicon-ui/auth': 'auth'
};

/**
 * The style-override contract every component carries (`unstyled` +
 * `slotClasses` + `class`, AGENTS.md → Key Architecture Decisions). Left out
 * of `keyPropTypes` and `propDocs` alike: the type is the same shape and the
 * JSDoc the same sentence on all of them, so per-component copies add bytes
 * and a uniform search hit but no information.
 */
const STYLE_OVERRIDE_PROPS = new Set(['class', 'unstyled', 'slotClasses']);

/**
 * Generates per-package catalog entries as JSON. The output is a partial
 * catalog that gets assembled into the final component-catalog.json by
 * CatalogAssembler.
 */
export class CatalogGenerator {
  private packageName: string;
  private llmOutputPath: string;

  constructor(packageName: string, llmOutputPath: string) {
    this.packageName = packageName;
    this.llmOutputPath = llmOutputPath;
  }

  async generate(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<{ path: string; count: number }> {
    const entries: ComponentCatalogEntry[] = [];

    for (const component of enrichedComponents) {
      const compApi = apiData.components[component.name];
      if (!compApi) continue;

      const entry = this.buildEntry(component, compApi);
      entries.push(entry);
    }

    const outputPath = path.join(this.llmOutputPath, '_catalog.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(entries, null, 2), 'utf-8');

    return { path: outputPath, count: entries.length };
  }

  private buildEntry(
    component: EnrichedComponentInfo,
    compApi: ComponentAPIData
  ): ComponentCatalogEntry {
    const group = (compApi.group || 'primitives') as 'primitives' | 'components' | 'core';
    const slug = toSlug(component.name);

    // The raw (un-defaulted) group, not the display default above — matching
    // the write loop in LLMDocumentationGenerator, which joins a group segment
    // onto the path only when the component actually has one. Using the
    // defaulted `group` here made the ternary dead (always truthy) and this
    // path silently disagreed with where the file landed for any component
    // with no group (`table`'s single entry has none).
    const llmTxtPath = compApi.group ? `${compApi.group}/${slug}/llm.txt` : `${slug}/llm.txt`;

    // Origin tag: every `@urbicon-ui/auth` component is discoverable via the
    // `auth` tag (`urbicon find --tag auth`) on top of its functional
    // tag (form/feedback/data). Derived from the package — not duplicated into
    // each component's JSDoc — so future auth components inherit it automatically.
    // Appended (not prepended) so `tags[0]` stays the functional tag the docs
    // site's family channels read (`channels-gen.ts`); the filter checks every
    // tag, not the first, so position doesn't affect discoverability.
    const originTag = ORIGIN_TAGS[this.packageName];
    const jsdocTags = component.tags || [];
    const tags =
      originTag && !jsdocTags.includes(originTag) ? [...jsdocTags, originTag] : jsdocTags;

    // Search-only text goes where search reads it; the internal package never
    // reaches the assembled catalog (see INTERNAL_PACKAGE).
    const searchable = this.packageName !== INTERNAL_PACKAGE;

    const variants = compApi.variants.map((v) => ({
      name: v.name,
      values: v.values,
      ...(v.defaultValue ? { default: v.defaultValue } : {}),
      ...(searchable && v.valueDescriptions && Object.keys(v.valueDescriptions).length > 0
        ? { valueDescriptions: v.valueDescriptions }
        : {})
    }));

    // Key props: top 8 most important direct props (not variant-source, not inherited)
    const directProps = compApi.props.filter(
      (p) => p.source.type === 'direct' || p.source.type === 'variant'
    );
    const keyProps = directProps.slice(0, 8).map((p) => p.name);

    /**
     * How wide this component's own API is — direct + variant props, inherited
     * HTML attributes excluded. Straight from `stats.totalProps`, **not**
     * recounted here: every doc page already prints that number as its "N
     * props" meta line, and a second count would put the landing page and the
     * component page in visible disagreement (Kbd: 8 against 10, because the
     * two disagree on whether a `...KbdVariants` spread placeholder is a prop).
     *
     * The catalogue needed the field regardless: it is what a surface reads
     * that has no `api.ts` at hand, and `keyProps.length` caps at eight — it
     * would have shown the same 8 for Calendar's 56 and Input's 34.
     */
    const propCount = compApi.stats.totalProps;

    // Non-primitive prop types — helps LLMs understand complex APIs without extra calls
    const PRIMITIVE_TYPES = new Set([
      'string',
      'boolean',
      'number',
      'undefined',
      'null',
      'Snippet',
      'MintProp'
    ]);
    const keyPropTypes: Record<string, string> = {};
    // The prop's own `values` — what llm.txt prints beside a named type — kept
    // apart from the type, so `keyPropTypes` stays valid TypeScript.
    const keyPropValues: Record<string, string[]> = {};
    for (const p of directProps) {
      if (p.name.startsWith('...')) continue;
      if (STYLE_OVERRIDE_PROPS.has(p.name)) continue;
      const baseType = p.type.replace(/\s*\|?\s*undefined$/, '').trim();
      if (!baseType || PRIMITIVE_TYPES.has(baseType)) continue;
      // Keep compound types, arrays, generics, unions with non-primitives
      if (/^(string|boolean|number)(\s*\|\s*(string|boolean|number))*$/.test(baseType)) continue;
      keyPropTypes[p.name] = baseType;
      if (p.values?.length) keyPropValues[p.name] = p.values;
    }

    // What each of the component's own props says — the hand-written JSDoc of
    // the direct props, description and (where a prop carries one) `@summary`.
    // Variant-source props are left out: their description is generated
    // boilerplate ("Controls the visual style…") that would match every
    // component the same way. So are the spread placeholder, the style-override
    // trio, and a prop with no JSDoc at all (the extractor's `<name> property`
    // stand-in says nothing the name does not).
    const propDocs: Record<string, ComponentCatalogPropDoc> = {};
    for (const p of directProps) {
      if (!searchable || p.source.type !== 'direct') continue;
      if (p.name.startsWith('...') || STYLE_OVERRIDE_PROPS.has(p.name)) continue;
      const description = p.description === noJsDocDescription(p.name) ? '' : p.description;
      if (!description && !p.summary) continue;
      propDocs[p.name] = {
        ...(description ? { description } : {}),
        ...(p.summary ? { summary: p.summary } : {})
      };
    }

    const slots = resolveSlotNames(compApi);

    const relatedComponents = (component.relatedComponents || []).filter(
      (r) => r !== component.name
    );

    return {
      name: component.name,
      slug,
      package: this.packageName,
      group,
      description: component.description || '',
      ...(component.summary ? { summary: component.summary } : {}),
      ...(compApi.stability ? { stability: compApi.stability } : {}),
      tags,
      import: `import { ${component.name} } from '${this.packageName}';`,
      llmTxtPath,
      variants,
      keyProps,
      propCount,
      keyPropTypes,
      keyPropValues,
      ...(Object.keys(propDocs).length > 0 ? { propDocs } : {}),
      slots,
      hasExamples: compApi.examples.length > 0,
      relatedComponents
    };
  }
}
