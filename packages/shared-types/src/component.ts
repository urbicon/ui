import type { DeprecationInfo } from './documentation.js';
import type { ComponentDocumentation } from './documentation-core.js';

/**
 * Component maturity / stability classifier — drives the Editorial
 * stability badge in the doc-page header. Defaults to `'stable'` when
 * the `@stability` JSDoc tag is omitted, on the assumption that most
 * shipped components are stable and the noise of a `BETA` badge on
 * every page is not what we want.
 */
export type ComponentStability = 'experimental' | 'beta' | 'stable' | 'deprecated';

/**
 * All the information that can be extracted and inferred from a component
 */
export interface ComponentInfo {
  // === IDENTITY ===
  /** Component name */
  name: string;
  /** Package name */
  packageName: string;
  /** Path to component file */
  filePath: string;
  /** Version */
  version?: string;
  /** Component description */
  description: string;
  /** Deprecation information */
  deprecated?: DeprecationInfo;
  /** Experimental status */
  experimental?: boolean;
  /** Version since when available */
  since?: string;
  /**
   * Maturity classifier — extracted from `@stability {experimental|beta|stable|deprecated}`
   * JSDoc. Drives the Editorial `[STABLE]` / `[BETA]` / etc. badge.
   * Defaults to `'stable'` if the tag is missing.
   */
  stability?: ComponentStability;
  /**
   * GitHub blob URL for the component's source file — built at
   * generation time from `filePath`. Drives the Editorial `source ↗`
   * link in the doc-page header.
   */
  sourceHref?: string;
  /** Category tags (e.g. form, layout, feedback) — extracted from @tag JSDoc */
  tags?: string[];
  /** Related component names — extracted from @related JSDoc */
  relatedComponents?: string[];

  // === TECHNICAL INFO ===
  /** Component properties */
  props: PropInfo[];
  /** Available variants */
  variants: VariantInfo[];
  /** Inheritance information */
  inheritance: InheritanceInfo[];
  /** Component statistics */
  stats: ComponentStats;

  // === DOCUMENTATION ===
  /** Component documentation */
  documentation?: ComponentDocumentation;
}

/**
 * Property information (from docs-gen)
 */
export interface PropInfo {
  /** Property name */
  name: string;
  /** TypeScript type */
  type: string;
  /** Whether property is required */
  required: boolean;
  /** Property description */
  description: string;
  /** Default value */
  defaultValue?: string;
  /** Where this prop comes from */
  source: PropSource;
  /** Usage examples */
  examples?: PropExample[];
  /** Deprecation info */
  deprecated?: DeprecationInfo;
  /** Experimental flag */
  experimental?: boolean;
  /** Version since available */
  since?: string;
  /** Values */
  values?: string[];
  /** See also */
  seeAlso?: string;
  /**
   * When the host type is a discriminated union (e.g.
   * `type Foo = A | B`), this records the variants in which the prop
   * actually exists. The `propName` points at the discriminator
   * property; `values` lists the discriminator values for which this
   * prop is applicable. Omit means the prop is unconditional.
   */
  conditionalOn?: {
    propName: string;
    values: string[];
  };
}

/**
 * Source of a property
 */
export interface PropSource {
  type: 'direct' | 'inherited' | 'variant';
  name?: string;
  package?: string;
  url?: string;
}

/**
 * Property usage example
 */
export interface PropExample {
  title: string;
  code: string;
  description?: string;
}

/**
 * Variant information (from docs-gen)
 */
export interface VariantInfo {
  /** Variant name */
  name: string;
  /** Available values */
  values: string[];
  /** Default value */
  defaultValue?: string;
  /** Variant examples */
  examples?: VariantExample[];
}

/**
 * Example for a specific variant
 */
export interface VariantExample {
  value: string;
  label: string;
  description?: string;
  code?: string;
}

/**
 * Inheritance information (from docs-gen)
 */
export interface InheritanceInfo {
  /** Type name */
  typeName: string;
  /** Source package/module */
  source: string;
  /** Inherited properties */
  props: PropInfo[];
  /** Documentation URL */
  url?: string;
}

/**
 * Component statistics (enhanced from docs-gen + shared-types)
 */
export interface ComponentStats {
  /** Total number of props */
  totalProps: number;
  /** Direct props (not inherited) */
  directProps: number;
  /** Variant-related props */
  variantProps: number;
  /** Inherited props */
  inheritedProps: number;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Cross-reference to other components or types (from docs-gen)
 */
export interface CrossReference {
  type: 'component' | 'type' | 'external';
  name: string;
  package: string;
  url?: string;
  description?: string;
}

/**
 * Package information (from docs-gen)
 */
export interface PackageInfo {
  name: string;
  version: string;
  description?: string;
  homepage?: string;
  repository?: string;
}
