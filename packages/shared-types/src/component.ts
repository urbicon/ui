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
  /** Component description — the long form, for `llm.txt` and the MCP catalog. */
  description: string;
  /**
   * One human-facing sentence, from `@summary` JSDoc. What the landing page
   * and the component index show under the name; `description` is the
   * contract an agent reads. Split apart in 2026-07 because one field for
   * both readers served neither — the median description ran 259 characters,
   * so the landing page truncated it mid-clause.
   */
  summary?: string;
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
  /**
   * One line for a person standing at a control, from a prop-level
   * `@summary`. The prop-level twin of {@link ComponentInfo.summary} and the
   * same division of labour: {@link PropInfo.description} is the contract an
   * agent reads and may run to a paragraph, this is the sentence a playground
   * shows beside a knob.
   *
   * Optional, and meant to stay that way — most props say all they need in one
   * sentence, and a required second field would mean hundreds of copies of the
   * first. Read it as `summary ?? description`.
   */
  summary?: string;
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
  /**
   * A **navigable** `@see` target: an absolute URL, a route-relative path
   * (`/blocks/primitives/button#variants`) or a bare fragment (`#type-Foo`).
   * Renderers turn this into a link on the prop's type. Set either from a
   * `@see` tag that carries such a target or by docs-gen's own type-link
   * resolution.
   */
  seeAlso?: string;
  /**
   * **Prose** `@see` references — bare type or member names such as
   * `HTMLButtonAttributes.value` or `CartesianDatum`, in source order.
   * These have no doc URL, so they are rendered as literal text rather than
   * as a link. Kept separate from {@link PropInfo.seeAlso} precisely so a
   * renderer never has to guess which of the two kinds it holds.
   */
  seeAlsoRefs?: string[];
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
