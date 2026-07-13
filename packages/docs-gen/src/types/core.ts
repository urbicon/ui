import type {
  ComponentExample,
  ComponentInfo,
  ComponentStability,
  ComponentStats,
  CrossReference,
  InheritanceInfo,
  PackageInfo,
  PropInfo,
  VariantInfo
} from '@urbicon-ui/shared-types';
import type { ValidationResult } from './validation';

// ==========================================
// DOCS-gen SPECIFIC TYPES
// Types that are specific to the docs generator pipeline
// Note: Core types (PropInfo, VariantInfo, etc.) now imported from shared-types
// ==========================================

// Use ComponentExample consistently (no more ValidatedExample)
export interface ValidatedExample extends ComponentExample {
  validation: ValidationResult;
}

// ==========================================
// DOCS-gen SPECIFIC ENRICHED COMPONENT TYPES
// ==========================================

export interface EnrichedComponentInfo extends ComponentInfo {
  crossReferences: CrossReference[];
  examples: ValidatedExample[];
}

// ==========================================
// PIPELINE & PROCESSING
// ==========================================

export interface ComponentManifest {
  component: ComponentInfo;
  files: ComponentFiles;
  packageInfo: PackageInfo;
}

export interface ComponentFiles {
  main: string;
  variants?: string;
  documentation?: string;
  examples?: string[];
  tests?: string[];
}

export interface DiscoveredMetadata {
  hasStructuredDocs: boolean;
  hasVariants: boolean;
  hasTests: boolean;
  packageInfo: PackageInfo;
}

// Note: ExtractionResult, ValidationResult, etc. are now imported from shared-types above

// ==========================================
// GENERATION RESULTS
// ==========================================

export interface APIData {
  components: Record<string, ComponentAPIData>;
  types: TypeDefinition[];
  metadata: APIMetadata;
}

export interface ComponentAPIData {
  name: string;
  props: PropInfo[];
  variants: VariantInfo[];
  inheritance: InheritanceInfo[];
  examples: string[];
  stats: ComponentStats;
  /**
   * `slotClasses` slot names, lifted from the `slots:` keys of the
   * component's tv() config by VariantsExtractor. Authoritative source for
   * the slot list on both catalog surfaces (llm.txt + MCP catalog) — the
   * public `XSlots` type is a `SlotNames<typeof xVariants>` alias the
   * prop-type regex cannot resolve, so this is how real slots reach output.
   * Omitted when the component declares no tv() `slots` block.
   */
  slots?: string[];
  /** Optional grouping for route placement, e.g., 'components' or 'primitives' */
  group?: string;
  /**
   * Editorial maturity badge — `@stability` JSDoc on the *Props
   * interface. Defaults to `'stable'` if omitted.
   */
  stability?: ComponentStability;
  /**
   * GitHub blob URL for the component's source file. Built at
   * generation time from the component's filePath.
   */
  sourceHref?: string;
  /**
   * Names of related components — extracted from `@related` JSDoc on
   * the *Props interface. Drives the `// RELATED` block in the TOC.
   */
  relatedComponents?: string[];
}

export interface TypeDefinition {
  name: string;
  type: 'interface' | 'type' | 'enum';
  definition: string;
  package: string;
  documentation?: string;
}

export interface APIMetadata {
  generated: string;
  version: string;
  totalComponents: number;
  totalProps: number;
  generator: string;
}

export interface GenerationResult {
  success: boolean;
  outputs: GeneratedOutput[];
  errors: GenerationError[];
  stats: GenerationStats;
  duration: number;
}

export interface GeneratedOutput {
  type: 'llm' | 'api';
  path: string;
  size: number;
  components: string[];
}

export interface GenerationError {
  type: string;
  message: string;
  component?: string;
  file?: string;
}

export interface GenerationStats {
  totalComponents: number;
  totalProps: number;
  apiDataSize: number;
}
