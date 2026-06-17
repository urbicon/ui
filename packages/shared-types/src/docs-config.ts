import type { ComponentBadge, ComponentMetadata, LLMConfig } from './documentation.js';
import type { ControlDefinition } from './playground.js';

/**
 * Configuration exported from docs.svelte files
 * Used for build-time processing and auto-section generation
 */
export interface SvelteDocsConfig {
  /** Configuration for auto-generated sections */
  generation?: {
    /** Interactive playground configuration */
    playground?: DocsPlaygroundConfig;

    /** Variants showcase configuration */
    variants?: VariantsConfig;

    /** Examples section - false means we provide custom */
    examples?: boolean | ExamplesConfig;

    /** API reference configuration */
    api?: ApiConfig;

    /** Overview section configuration */
    overview?: OverviewConfig;

    /** Usage notes configuration */
    usage?: boolean | UsageConfig;
  };

  /** LLM-specific configuration (extends shared config) */
  llm?: LLMConfig;

  /** Component metadata (extends shared metadata) */
  meta?: DocsMetadata;
}

/**
 * Playground configuration for docs generation
 * Simple configuration for auto-generating playground sections
 */
export interface DocsPlaygroundConfig {
  /** Props to feature in the playground */
  featured?: string[];
  /** Props to exclude from playground */
  exclude?: string[];
  /** Default values for playground */
  defaults?: Record<string, unknown>;
  /** Additional/override controls for the playground */
  controls?: ControlDefinition[];
  /** Enable/disable playground */
  enabled?: boolean;
  /** Section order */
  order?: number;
}

/**
 * Variants showcase configuration
 */
export interface VariantsConfig {
  /** Variants to exclude from showcase */
  exclude?: string[];
  /** How to group variants (by intent, size, etc.) */
  groupBy?: string;
  /** Maximum variants to show per group */
  limit?: number;
  /** Enable/disable variants section */
  enabled?: boolean;
  /** Section order */
  order?: number;
}

/**
 * Examples section configuration
 */
export interface ExamplesConfig {
  /** Enable/disable examples section */
  enabled?: boolean;
  /** Section order */
  order?: number;
  /** Maximum examples to show */
  limit?: number;
}

/**
 * API reference configuration
 */
export interface ApiConfig {
  /** Show inherited properties */
  showInheritance?: boolean;
  /** Group properties by category */
  groupBy?: 'type' | 'category' | 'alphabetical';
  /** Show deprecated properties */
  showDeprecated?: boolean;
  /** Enable/disable API section */
  enabled?: boolean;
  /** Section order */
  order?: number;
}

/**
 * Overview section configuration
 */
export interface OverviewConfig {
  /** Show component stats */
  showStats?: boolean;
  /** Show tier badges */
  showBadges?: boolean;
  /** Enable/disable overview section */
  enabled?: boolean;
  /** Section order */
  order?: number;
}

/**
 * Usage notes configuration
 */
export interface UsageConfig {
  /** Enable/disable usage notes section */
  enabled?: boolean;
  /** Section order */
  order?: number;
}

/**
 * Docs-specific metadata (extends shared ComponentMetadata)
 */
export interface DocsMetadata extends Partial<ComponentMetadata> {
  /** Component title (defaults to component name) */
  title?: string;
  /** Show table of contents */
  showToc?: boolean;
  /** Custom badges to display */
  badges?: ComponentBadge[];
}
