import type { ComponentInfo } from './component.js';
import type { ComponentBadge, LLMConfig } from './documentation.js';
import type { ComponentExample, UsagePattern } from './examples.js';
import type { NavigationItem } from './navigation.js';
import type { PlaygroundConfig } from './playground.js';

/**
 * Documentation section for generation pipeline
 * Used for rendering and processing documentation sections
 */
export interface DocumentationSection {
  /** Unique section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section type - primary categorization */
  type: SectionType;
  /** Display order */
  order: number;
  /** Section content */
  content: SectionContent;
}

/**
 * Available section types
 */
export type SectionType =
  | 'overview'
  | 'playground'
  | 'examples'
  | 'variants'
  | 'api'
  | 'types'
  | 'accessibility'
  | 'custom'
  | 'text';

/**
 * Union type for different section content types
 * Content type is inferred from DocumentationSection.type
 */
export type SectionContent =
  | ExampleContent
  | PlaygroundContent
  | TextContent
  | ApiContent
  | VariantsContent
  | CustomContent;

/**
 * Example section content
 */
export interface ExampleContent {
  examples: ComponentExample[];
  showCategories?: boolean;
  groupByCategory?: boolean;
}

/**
 * Playground section content
 */
export interface PlaygroundContent {
  config: PlaygroundConfig;
  showCodePreview?: boolean;
  showInlineControls?: boolean;
}

/**
 * Text/markdown section content
 */
export interface TextContent {
  content: string;
  format?: 'markdown' | 'html' | 'plain';
  variables?: Record<string, unknown>;
}

/**
 * API reference section content. `props` is typed as `unknown[]` because
 * this base type ships without a runtime dependency on docs-gen's PropInfo.
 */
export interface ApiContent {
  props: unknown[];
  showInherited?: boolean;
  groupByCategory?: boolean;
  showExamples?: boolean;
}

/**
 * Variants showcase section content. `variants` is typed as `unknown[]`
 * because this base type ships without a runtime dependency on docs-gen's
 * VariantInfo.
 */
export interface VariantsContent {
  variants: unknown[];
  showExamples?: boolean;
  showCombinations?: boolean;
}

/**
 * Custom section content
 */
export interface CustomContent {
  content: string;
  template?: string;
  variables?: Record<string, unknown>;
}

/**
 * Complete component documentation structure.
 * Either auto-generated or manually created.
 */
export interface ComponentDocumentation {
  /** Component identifier */
  component: string;
  /** Display title */
  title: string;
  /** Component description */
  description: string;

  /** Display badges */
  badges?: ComponentBadge[];

  /** Auto-generated sections configuration */
  autoSections: AutoSectionsConfig;

  /** Custom sections */
  customSections?: CustomSection[];

  /** Section structure and ordering */
  sectionStructure?: SectionStructure;

  /** Navigation items */
  navigation?: NavigationItem[];

  /** LLM-specific settings */
  llmSettings: LLMSettings;

  /** Documentation metadata */
  metadata?: DocumentationMetadata;

  /** Documentation sections (for docs-gen compatibility) */
  sections?: DocumentationSection[];
}

/**
 * Configuration for auto-generated sections
 */
export interface AutoSectionsConfig {
  /** Interactive playground */
  playground: boolean;
  /** Basic usage examples */
  basicUsage: boolean;
  /** Variants showcase */
  variants: boolean;
  /** Size variations */
  sizes: boolean;
  /** Intent variations */
  intents: boolean;
  /** Mint micro-interactions */
  mint: boolean | string | string[];
  /** API reference */
  api: boolean;
  /** Accessibility section */
  accessibility: boolean;
}

/**
 * Custom documentation section
 */
export interface CustomSection {
  /** Unique section ID */
  id: string;
  /** Section title */
  title: string;
  /** Section subtitle */
  subtitle?: string;
  /** Section content (markdown/HTML) */
  content: string;
  /** Include in LLM output */
  includeLLM?: boolean;
  /** Order within parent section */
  order?: number;
  /** Parent section ID */
  parentSection?: string;
}

/**
 * Section structure and ordering
 */
export interface SectionStructure {
  /** Custom section order */
  order?: string[];
  /** Custom parent section configurations */
  customParents?: Record<string, ParentSectionConfig>;
}

/**
 * Parent section configuration
 */
export interface ParentSectionConfig {
  /** Section title */
  title: string;
  /** Section subtitle */
  subtitle?: string;
  /** Section ID (auto-generated if not provided) */
  id?: string;
}

/**
 * LLM generation settings
 */
export interface LLMSettings extends LLMConfig {
  /** Include playground section */
  includePlayground: boolean;
  /** Include complex examples */
  includeComplexExamples: boolean;
  /** Include full API reference */
  includeFullAPI: boolean;
  /** Maximum examples per section */
  maxExamplesPerSection: number;
  /** Content simplification level */
  simplificationLevel?: 'none' | 'basic' | 'aggressive';
}

/**
 * Documentation metadata
 */
export interface DocumentationMetadata {
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Documentation version */
  version?: string;
  /** Contributors */
  contributors?: string[];
  /** Review status */
  reviewStatus?: 'draft' | 'review' | 'approved';
  /** Related components */
  relatedComponents?: string[];
}

/**
 * Complete documentation files structure
 */
export interface ComponentDocumentationFiles {
  /** Component examples */
  examples: ComponentExample[];
  /** Playground configuration */
  playground: PlaygroundConfig;
  /** Main documentation content */
  content: ComponentDocumentation;
  /** Usage patterns */
  patterns?: UsagePattern[];
  /** Associated component info */
  component?: ComponentInfo;
}

// Re-export for convenience
export type { ComponentExample, PlaygroundConfig, UsagePattern };
