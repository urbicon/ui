import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';

// Minimal helpers for LLM docs: validate and merge docsConfig
export function isValidSvelteDocsConfig(config: unknown): config is SvelteDocsConfig {
  return typeof config === 'object' && config !== null;
}

export const DEFAULT_SVELTE_DOCS_CONFIG: SvelteDocsConfig = {
  generation: {
    playground: { featured: [], exclude: [], defaults: {}, enabled: true, order: 2 },
    variants: { exclude: [], groupBy: 'variant', limit: 20, enabled: false, order: 4 },
    examples: false,
    api: { showInheritance: true, showDeprecated: true, enabled: true, order: 9 },
    overview: { enabled: false }
  },
  llm: {
    include: true,
    maxSections: 6,
    priority: ['overview', 'examples', 'variants', 'api'],
    excludeTypes: ['playground'],
    simplifyContent: true
  },
  meta: { showToc: true, badges: [] }
};

export function mergeWithSvelteDocsDefaults(userConfig: SvelteDocsConfig): SvelteDocsConfig {
  return {
    generation: {
      ...DEFAULT_SVELTE_DOCS_CONFIG.generation,
      ...userConfig.generation,
      playground: {
        ...DEFAULT_SVELTE_DOCS_CONFIG.generation?.playground,
        ...userConfig.generation?.playground
      },
      variants: {
        ...DEFAULT_SVELTE_DOCS_CONFIG.generation?.variants,
        ...userConfig.generation?.variants
      },
      api: { ...DEFAULT_SVELTE_DOCS_CONFIG.generation?.api, ...userConfig.generation?.api },
      overview: {
        ...DEFAULT_SVELTE_DOCS_CONFIG.generation?.overview,
        ...userConfig.generation?.overview
      }
    },
    llm: { ...DEFAULT_SVELTE_DOCS_CONFIG.llm, ...userConfig.llm },
    meta: { ...DEFAULT_SVELTE_DOCS_CONFIG.meta, ...userConfig.meta }
  };
}
