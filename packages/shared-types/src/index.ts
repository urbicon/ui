// Core documentation types (original)

// Core component types
export type {
  ComponentInfo,
  ComponentStats,
  CrossReference,
  InheritanceInfo,
  PackageInfo,
  PropExample,
  PropInfo,
  PropSource,
  VariantExample,
  VariantInfo
} from './component.js';

// Svelte docs configuration types (original)
export type {
  ApiConfig,
  DocsMetadata,
  DocsPlaygroundConfig,
  ExamplesConfig,
  OverviewConfig,
  SvelteDocsConfig,
  UsageConfig,
  VariantsConfig
} from './docs-config.js';
export type {
  ComponentBadge,
  ComponentMetadata,
  DeprecationInfo,
  LLMConfig,
  SectionOrder
} from './documentation.js';

// (documentation-core types not re-exported anymore)

// Example and pattern types
export type {
  ComponentExample,
  ExampleCollection,
  ExampleGroup,
  UsagePattern
} from './examples.js';
// Navigation types
export type {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbSettings,
  NavigationBadge,
  NavigationContext,
  NavigationItem,
  NavigationMetadata,
  NavigationSearchResult,
  NavigationState,
  SearchMatch,
  SiteNavigation,
  TableOfContents,
  TOCItem,
  TOCSettings
} from './navigation.js';
// Playground types
export type {
  CodeGenerator,
  CodeGeneratorConfig,
  ControlCondition,
  ControlDefinition,
  ControlOption,
  ControlType,
  ImportStatement,
  PlaygroundConfig,
  PlaygroundExample,
  PlaygroundFeature,
  PlaygroundMetadata
} from './playground.js';

// ==========================================
// BARREL EXPORTS
// ==========================================

export * from './component.js';
export * from './docs-config.js';
// Re-export everything for convenience (except documentation-core)
export * from './documentation.js';
export * from './examples.js';
export * from './navigation.js';
export * from './playground.js';
