import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { APIData, ComponentAPIData, EnrichedComponentInfo } from '../../types';

export interface ComponentCatalogEntry {
  name: string;
  slug: string;
  package: string;
  group: 'primitives' | 'components' | 'core';
  description: string;
  tags: string[];
  import: string;
  llmTxtPath: string;
  variants: { name: string; values: string[]; default?: string }[];
  keyProps: string[];
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
}

export interface ComponentCatalog {
  generated: string;
  version: string;
  components: ComponentCatalogEntry[];
  recipes: RecipeEntry[];
  tags: string[];
}

/** Internal docs-infrastructure components — excluded from the public catalog */
const INTERNAL_COMPONENTS = new Set([
  'ApiReference',
  'CodeExample',
  'CodePanel',
  'DocsLayout',
  'InfoCard',
  'PlaygroundConfigurator',
  'Section',
  'TableOfContents',
  'TypesReference'
]);

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
      if (INTERNAL_COMPONENTS.has(component.name)) continue;

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
    const slug = this.toSlug(component.name);

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

    const slots = this.extractSlots(compApi);

    const relatedComponents = (component.relatedComponents || []).filter(
      (r) => r !== component.name
    );

    return {
      name: component.name,
      slug,
      package: this.packageName,
      group,
      description: component.description || '',
      tags,
      import: `import { ${component.name} } from '${this.packageName}';`,
      llmTxtPath,
      variants,
      keyProps,
      keyPropTypes,
      slots,
      hasExamples: compApi.examples.length > 0,
      relatedComponents
    };
  }

  private extractSlots(compApi: ComponentAPIData): string[] {
    const slotNames = new Set<string>();

    for (const v of compApi.variants) {
      if (v.name === 'slot' || v.name === 'slots') {
        for (const val of v.values) {
          if (val.trim()) slotNames.add(val);
        }
      }
    }

    for (const prop of compApi.props) {
      if (prop.name === 'slotClasses' && prop.type) {
        const match = prop.type.match(/Record<['"]([\w\s|']+)['"],/);
        if (match?.[1]) {
          const keys = match[1]
            .split(/[|']/)
            .filter(Boolean)
            .map((s) => s.trim());
          keys
            .filter((k) => k)
            .forEach((k) => {
              slotNames.add(k);
            });
        }
      }
    }

    return Array.from(slotNames);
  }

  private toSlug(input: string): string {
    return input
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/_/g, '-')
      .replace(/\s+/g, '-')
      .toLowerCase();
  }
}
