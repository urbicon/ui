import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../../types';
import { toSlug } from '../../utils/slug';
import { resolveSlotNames } from '../shared/slots';

export interface ComponentCatalogEntry {
  name: string;
  slug: string;
  package: string;
  group: 'primitives' | 'components' | 'core';
  /** The long form: the contract an agent reads. */
  description: string;
  /**
   * The short form: one sentence for a human, under the component's name.
   * Absent while a component still has no `@summary` — consumers fall back to
   * `description`, which is what the landing page did before the split.
   */
  summary?: string;
  /**
   * Editorial maturity. Extracted per component since forever, but dropped on
   * the way into this catalog until 2026-07-27 — which is why the landing
   * page carried a hand-written list of beta components that named four of
   * the thirty-eight.
   */
  stability?: 'experimental' | 'beta' | 'stable' | 'deprecated';
  tags: string[];
  import: string;
  llmTxtPath: string;
  variants: { name: string; values: string[]; default?: string }[];
  keyProps: string[];
  /**
   * Size of the component's own API: direct + variant props, inherited HTML
   * attributes excluded. Mirrors `stats.totalProps`, the number each doc page
   * prints — distinct from `keyProps.length`, which caps at eight.
   */
  propCount: number;
  /** Non-primitive prop types (objects, arrays, unions) — omits string/boolean/number */
  keyPropTypes: Record<string, string>;
  slots: string[];
  hasExamples: boolean;
  relatedComponents: string[];
}

export interface RecipeEntry {
  id: string;
  title: string;
  description: string;
  components: string[];
  code: string;
  features: string[];
  /** Layer-4 composition pattern this recipe instantiates (e.g. "dashboard"). Cross-links to `get_pattern`. */
  pattern?: string;
}

export interface ComponentCatalog {
  generated: string;
  version: string;
  components: ComponentCatalogEntry[];
  recipes: RecipeEntry[];
  tags: string[];
}

// The docs-infrastructure exclusion lives in MCPCatalogAssembler now — see
// INTERNAL_COMPONENTS there. Filtering here emptied `_catalog.json` for the
// docs target, which is also what `summary:lint` and the docs site read.

/**
 * Package → origin tag. Components from these packages carry an extra discovery
 * tag (alongside their functional tag) so the whole surface is filterable in one
 * query, e.g. `find_components({ tags: ['auth'] })`. Keep in sync with the
 * `find_components` tool description.
 */
const ORIGIN_TAGS: Record<string, string> = {
  '@urbicon-ui/auth': 'auth'
};

/**
 * Generates per-package catalog entries as JSON for MCP server consumption.
 * The output is a partial catalog that gets assembled into the final
 * component-catalog.json by MCPCatalogAssembler.
 */
export class MCPCatalogGenerator {
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

    const llmTxtPath = group ? `${group}/${slug}/llm.txt` : `${slug}/llm.txt`;

    // Origin tag: every `@urbicon-ui/auth` component is discoverable via the
    // `auth` tag (`find_components({ tags: ['auth'] })`) on top of its functional
    // tag (form/feedback/data). Derived from the package — not duplicated into
    // each component's JSDoc — so future auth components inherit it automatically.
    // Appended (not prepended) so `tags[0]` stays the functional tag that drives
    // catalog grouping (format-catalog.ts); the filter checks every tag, not the
    // first, so position doesn't affect discoverability.
    const originTag = ORIGIN_TAGS[this.packageName];
    const jsdocTags = component.tags || [];
    const tags =
      originTag && !jsdocTags.includes(originTag) ? [...jsdocTags, originTag] : jsdocTags;

    const variants = compApi.variants.map((v) => ({
      name: v.name,
      values: v.values,
      ...(v.defaultValue ? { default: v.defaultValue } : {})
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
    for (const p of directProps) {
      if (p.name.startsWith('...')) continue;
      if (p.name === 'class' || p.name === 'unstyled' || p.name === 'slotClasses') continue;
      const baseType = p.type.replace(/\s*\|?\s*undefined$/, '').trim();
      if (!baseType || PRIMITIVE_TYPES.has(baseType)) continue;
      // Keep compound types, arrays, generics, unions with non-primitives
      if (/^(string|boolean|number)(\s*\|\s*(string|boolean|number))*$/.test(baseType)) continue;
      keyPropTypes[p.name] = baseType;
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
      slots,
      hasExamples: compApi.examples.length > 0,
      relatedComponents
    };
  }
}
