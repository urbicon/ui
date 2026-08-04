import type {
  ComponentExample,
  ComponentInfo,
  ComponentStability,
  ComponentStats,
  CrossReference,
  InheritanceInfo,
  PackageInfo,
  PropInfo,
  PropSource,
  VariantInfo
} from '@urbicon-ui/shared-types';
import type { ValidationResult } from './validation';

// ==========================================
// DOCS-gen SPECIFIC TYPES
// Types that are specific to the docs generator pipeline
// Note: Core types (PropInfo, VariantInfo, etc.) now imported from shared-types
// ==========================================

/**
 * A component code example carrying the result of validating it (syntax,
 * schema). Extends the shared `ComponentExample` so validated and raw
 * examples stay structurally compatible.
 */
export interface ValidatedExample extends ComponentExample {
  /** Outcome of validating this example's code. */
  validation: ValidationResult;
}

// ==========================================
// DOCS-gen SPECIFIC ENRICHED COMPONENT TYPES
// ==========================================

/**
 * A component after Phase 3 (enrichment): the extracted `ComponentInfo` plus
 * cross-references and validated examples. This is the shape the generators
 * (LLM, API) consume; its `stats` are harmonised with `APIData` by the
 * orchestrator so both surfaces report identical numbers.
 */
export interface EnrichedComponentInfo extends ComponentInfo {
  /** Links to related components/types resolved during enrichment. */
  crossReferences: CrossReference[];
  /** Code examples that passed through validation. */
  examples: ValidatedExample[];
}

// ==========================================
// PIPELINE & PROCESSING
// ==========================================

/**
 * Phase 1 (discovery) output for one component: the component identity plus
 * where its files live and which package it belongs to. One manifest per
 * matched entry point; extraction runs off this.
 */
export interface ComponentManifest {
  /** Component identity (name, entry filePath, package). */
  component: ComponentInfo;
  /** Absolute paths of the component's discovered files. */
  files: ComponentFiles;
  /** The owning package's metadata (from its package.json). */
  packageInfo: PackageInfo;
}

/**
 * File locations discovered for a component. Only `main` (the `index.ts`
 * entry) is guaranteed; the rest depend on the package's `GlobConfig` and on
 * what actually exists next to the component.
 */
export interface ComponentFiles {
  /** The component's entry `index.ts` (props interface + exports). */
  main: string;
  /** The tv() variants file (`*.variants.ts`), when one was matched. */
  variants?: string;
  /** The authored `docs.svelte`, when one was matched. */
  documentation?: string;
  /** Example files, when matched. */
  examples?: string[];
  /** Test files, when matched. */
  tests?: string[];
}

/**
 * Discovery-time facts about a component, before any extraction ran — which
 * optional surfaces (docs, variants, tests) exist on disk.
 */
export interface DiscoveredMetadata {
  /** Whether an authored docs.svelte was found. */
  hasStructuredDocs: boolean;
  /** Whether a variants file was found. */
  hasVariants: boolean;
  /** Whether test files were found. */
  hasTests: boolean;
  /** The owning package's metadata. */
  packageInfo: PackageInfo;
}

// Note: ExtractionResult, ValidationResult, etc. are now imported from shared-types above

// ==========================================
// GENERATION RESULTS
// ==========================================

/**
 * The complete API dataset for one target (blocks/docs/table/auth), produced
 * by `APIDataGenerator` in Phase 3 and consumed by every Phase 4 generator.
 * Single source of truth for props, variants, inheritance, and stats — the
 * emitted `api.ts` files and llm.txt docs are projections of this.
 */
export interface APIData {
  /** Per-component API data, keyed by component name. */
  components: Record<string, ComponentAPIData>;
  /** Package-level type definitions not attached to a single component. */
  types: TypeDefinition[];
  /** Generation metadata (timestamp, version, totals). */
  metadata: APIMetadata;
}

/**
 * One component's complete API surface as generated: props (sorted and
 * enriched), variant axes, inherited interfaces, examples, and stats. This
 * exact shape is serialised into the per-component `api.ts`
 * (`componentData`) that every docs page imports.
 */
export interface ComponentAPIData {
  /** Component name (PascalCase, e.g. `Combobox`). */
  name: string;
  /** Enriched, display-ordered props (direct + inherited + variant-derived). */
  props: PropInfo[];
  /** Variant axes from the tv() config (name, values, default). */
  variants: VariantInfo[];
  /** Inherited interfaces (heritage clauses) with their enumerated props. */
  inheritance: InheritanceInfo[];
  /** Usage examples (`@example` blocks off the props interface). */
  examples: string[];
  /** Prop counts by source (direct/variant/inherited). */
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
   * One human-facing sentence — `@summary` JSDoc on the *Props interface.
   * What the landing page and the component index show under the name.
   * `description` stays the long form for `llm.txt` and the MCP catalog.
   */
  summary?: string;
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
  /**
   * Local + imported type definitions attached by the extraction phase
   * (LocalTypesExtractor) and enriched by APIDataGenerator (`scope`,
   * `usedByProps`, `category`). Consumed by the docs app's TypesReference
   * and the llm.txt "Types" section.
   */
  types?: TypeDefinition[];
}

/**
 * One prop that refers to a `TypeDefinition`, collected by `APIDataGenerator`
 * while building the reverse index over a component's props.
 */
export interface TypeUsedByRef {
  /** Component that owns the prop. */
  component: string;
  /** Prop name within that component. */
  propName: string;
  /**
   * How the prop reaches the type. Same union as `PropSource['type']` — the
   * value is copied straight off the prop, so widening it to `string` here
   * would only make the emitted artifact unassignable to the docs package's
   * `TypeUsedByRef`, which spells the union out.
   */
  source: PropSource['type'];
}

/**
 * Coarse classification assigned during enrichment so type surfaces can pick
 * their audience: `props` (a `*Props` interface), `variant` (tv() machinery —
 * `VariantProps<…>` / `SlotNames<…>` aliases), `helper` (everything else,
 * i.e. the business types).
 */
export type TypeCategory = 'props' | 'variant' | 'helper';

/**
 * A supporting type definition attached to a component — extracted by
 * `LocalTypesExtractor` from the component's `index.ts`/variants file or
 * resolved from elsewhere in the package via the shared ts.Program. Rendered
 * by the docs app's TypesReference and the llm.txt "Types" section.
 */
export interface TypeDefinition {
  /** Type name as declared (e.g. `MenuItemType`). */
  name: string;
  /** `class` entries carry a public-signature summary as their definition. */
  type: 'interface' | 'type' | 'enum' | 'class';
  /** The rendered definition body (members for interfaces/enums, the aliased type for aliases). */
  definition: string;
  /** Package the type belongs to. */
  package: string;
  /** JSDoc text found on the declaration. */
  documentation?: string;
  /**
   * Where the definition lives relative to the component's `index.ts`:
   * `local` (declared in index.ts / the variants file) or `imported`
   * (declared elsewhere in the package and pulled in via a type-only
   * import, resolved through the shared ts.Program). Defaults to `local`
   * during enrichment when unset.
   */
  scope?: 'local' | 'imported';
  /**
   * Top-level member count (interface/enum members, public class members).
   * Unset for type aliases. Feeds the llm.txt oversize summary so a capped
   * type still reports its shape honestly.
   */
  members?: number;
  /**
   * Repo-relative path of the declaring file (from the `packages/` segment
   * when present). Lets the llm.txt oversize summary point at the full
   * definition instead of truncating it.
   */
  sourcePath?: string;
  /**
   * A `@see` value the docs can navigate to (absolute URL, route-relative
   * path, or a bare fragment). Same split as `PropInfo.seeAlso` — the rule
   * lives once, on `TypeScriptBaseExtractor.extractSeeTags`.
   */
  seeAlso?: string;
  /**
   * `@see` values that are prose references, not link targets — a sibling
   * type name (`CartesianDatum`) or a member path. Rendered as literal text.
   */
  seeAlsoRefs?: string[];
  /**
   * Whether the name is reachable from one of the package's **public entry
   * points** (`package.json#exports` → `src/lib/…`), i.e. whether a consumer
   * can write `import type { X } from '@urbicon-ui/blocks'`.
   *
   * This — not `category` — is the property that separates a type worth
   * documenting from tv() plumbing: filtering on `category === 'helper'`
   * would discard 203 `*Props` interfaces and 127 exported variant aliases,
   * the very names a consumer types. Resolved by
   * `LocalTypesExtractor` through the shared program's checker.
   *
   * Omitted (not `false`) when the export surface could not be determined —
   * single-file mode, or a package root without a resolvable entry. An
   * absent flag means "unknown", never "not exported".
   */
  exported?: boolean;
  /**
   * The **documented component that declares this type** — its canonical
   * home. Set by `APIDataGenerator` from the declaring file's directory; for
   * a compound directory serving several documented components
   * (`components/Guide/` → Guide, GuidePanel, GuideBeacon, …) the sibling
   * whose name is the longest prefix of the type name wins.
   *
   * Equal to the owning component for a type declared on its own page;
   * *different* when the entry is a copy that `collectImportedTypes` pulled
   * in (`DialogIntent` on the ConfirmDialog page → `Dialog`), which is what
   * lets a renderer show a reference instead of a second full body.
   *
   * Omitted when no documented component declares the type — library
   * plumbing out of `$lib/utils`, `$lib/mint`, `$lib/internal`. Those have
   * no home to point at; 352 of them are exported package API, so an absent
   * `owner` is *not* a licence to drop the entry.
   */
  owner?: string;
  /**
   * Audience classification assigned during enrichment. See `TypeCategory`.
   * Defaults to `helper` on the consuming side when unset.
   */
  category?: TypeCategory;
  /** Props that refer to this type — reverse index built during enrichment. */
  usedByProps?: TypeUsedByRef[];
  /** `usedByProps.length`, precomputed for the emitted artifacts. */
  usedByCount?: number;
}

/**
 * Provenance stamp on an `APIData` set: when it was generated, by which
 * generator version, and its component/prop totals. Emitted into every
 * generated artifact header.
 */
export interface APIMetadata {
  /** ISO timestamp of the generation run. */
  generated: string;
  /** Generator/package version that produced the data. */
  version: string;
  /** Number of components in the set. */
  totalComponents: number;
  /** Total prop count across all components. */
  totalProps: number;
  /** Identifier of the producing generator. */
  generator: string;
}

/**
 * Outcome of one full pipeline run (`PipelineOrchestrator.execute`): overall
 * verdict, the artifacts written, accumulated errors, and headline stats.
 * `success: false` results still carry the errors that explain the failure.
 */
export interface GenerationResult {
  /** `true` when the pipeline completed without blocking errors. */
  success: boolean;
  /** Artifacts written by the generation phase. */
  outputs: GeneratedOutput[];
  /** Errors accumulated across all phases (empty on a clean run). */
  errors: GenerationError[];
  /** Headline numbers for reporting. */
  stats: GenerationStats;
  /** Wall-clock duration of the run in milliseconds. */
  duration: number;
}

/**
 * One written artifact (or artifact tree) from the generation phase, e.g.
 * the per-component llm.txt tree or the api.ts directory.
 */
export interface GeneratedOutput {
  /** Which generator produced it. */
  type: 'llm' | 'api';
  /** Output path (a directory in per-component mode, a file otherwise). */
  path: string;
  /** Total bytes written. */
  size: number;
  /** Names of the components covered by this output. */
  components: string[];
}

/**
 * A single pipeline error in a `GenerationResult`, categorised by `type`
 * (e.g. `pipeline_error`, `props_extraction_failed`) and optionally pinned
 * to a component or file.
 */
export interface GenerationError {
  /** Machine-readable error category. */
  type: string;
  /** Human-readable explanation. */
  message: string;
  /** Component the error occurred on, when attributable. */
  component?: string;
  /** File the error occurred in, when attributable. */
  file?: string;
}

/**
 * Headline statistics of a pipeline run, reported alongside the outputs.
 */
export interface GenerationStats {
  /** Components processed. */
  totalComponents: number;
  /** Props extracted across all components. */
  totalProps: number;
  /** Size of the generated API data in bytes. */
  apiDataSize: number;
}
