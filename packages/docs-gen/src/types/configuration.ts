import type { ValidationConfig, ValidationRule } from './validation';

/**
 * Root configuration for one docs-gen run: what to read (`input`), how to
 * extract and enrich it (`processing`), and which artifacts to write
 * (`output`). Built via `DocsConfigurationBuilder` / the `ConfigurationFactory`
 * presets (blocks/docs/table/auth) and handed to `PipelineOrchestrator`.
 */
export interface GeneratorConfig {
  /** Source packages, schema expectations, and the package tsconfig. */
  input: InputConfig;
  /** Extraction, enrichment, validation, and parallelism settings. */
  processing: ProcessingConfig;
  /** LLM + API artifact targets. */
  output: OutputConfig;
  /** Debug verbosity and reporting; `level` also feeds the pipeline's ErrorHandler. */
  debug?: DebugConfig;
}

/**
 * Everything the pipeline reads: the packages to scan plus how to interpret
 * them (docs schema version, TypeScript project context).
 */
export interface InputConfig {
  /** Packages to scan for components; at least one is required (`validate()` enforces this). */
  packages: PackageConfig[];
  /** docs.svelte schema expectations (version, strictness). */
  schema: SchemaConfig;
  /**
   * Package TypeScript context. `configPath` is the switch between single-file
   * parsing and real cross-file type resolution — ExtractionCoordinator merges
   * it into the extraction config and validates it eagerly (fail-loud).
   */
  typescript?: TypeScriptConfig;
}

/**
 * One source package to scan. `ComponentFinder` globs `glob.components`
 * relative to `path` and builds a `ComponentManifest` per match.
 */
export interface PackageConfig {
  /** Package name as published (e.g. `@urbicon-ui/blocks`); stamped onto every discovered component. */
  name: string;
  /** Package root, relative to the docs-gen CWD (e.g. `../blocks`) or absolute. */
  path: string;
  /** Glob patterns locating component entry points and their sibling files. */
  glob: GlobConfig;
  /** Allowlist of component names; when set, discovery keeps only these. */
  include?: string[];
  /** Glob patterns passed to discovery as `ignore` (e.g. a fixtures directory). */
  exclude?: string[];
}

/**
 * Glob patterns (relative to the package root) that locate a component's
 * files. `components` finds the entry `index.ts`; the optional patterns
 * attach sibling files onto the manifest (`ComponentFiles`).
 */
export interface GlobConfig {
  /** Required. Pattern for component entry points — the blocks preset matches every `index.ts` under `src/lib/{primitives,components}/`. */
  components: string;
  /** Pattern for tv() variants files (`*.variants.ts`); matched per component directory. */
  variants?: string;
  /** Pattern for authored `docs.svelte` files. */
  documentation?: string;
  /** Pattern for test files. */
  tests?: string;
}

/**
 * Expectations about the authored `docsConfig` schema in docs.svelte files.
 * Currently declarative — the parser reports schema problems on its own
 * (`SvelteDocsParser` fails loud on unreadable configs regardless).
 */
export interface SchemaConfig {
  /** Expected docs schema version; the builder defaults to `2.0.0`. */
  version: string;
  /** Whether unknown/malformed docs configs should be treated as errors. */
  strict?: boolean;
  /** Whether sections not known to the schema are tolerated. */
  allowUnknownSections?: boolean;
  /** Settings for migrating older docs schemas forward. */
  migration?: MigrationConfig;
}

/**
 * Schema-migration behaviour for older authored docs configs. Declared for
 * the schema contract; no migration pass exists in the current pipeline.
 */
export interface MigrationConfig {
  /** Master switch for schema migration. */
  enabled: boolean;
  /** Schema version to migrate from; detected when omitted. */
  fromVersion?: string;
  /** Keep a copy of the pre-migration file. */
  backupOriginal?: boolean;
  /** Log every transformation applied during migration. */
  logChanges?: boolean;
}

/**
 * TypeScript project context for a package. Its single field, `configPath`,
 * is load-bearing: authored by every `ConfigurationFactory` preset, threaded
 * by `ExtractionCoordinator` (constructor and `updateConfig` alike) into the
 * extractors, where it backs the shared `ts.Program` for cross-file type
 * resolution. A configured-but-broken path aborts the run eagerly.
 */
export interface TypeScriptConfig {
  /** Path to the package `tsconfig.json` (absolute, or relative to the docs-gen CWD). */
  configPath?: string;
}

/**
 * Phase 2+3 settings: how component data is extracted from source, enriched,
 * validated, and whether components are processed in parallel batches.
 */
export interface ProcessingConfig {
  /** Per-extractor settings (TypeScript, variants, documentation, inheritance). */
  extraction: ExtractionConfig;
  /** Cross-reference and metadata enrichment settings. */
  enrichment: EnrichmentConfig;
  /** Validation rules applied to extracted data (shape shared with `types/validation`). */
  validation: ValidationConfig;
  /** Batched parallel extraction; sequential when omitted or disabled. */
  parallel?: ParallelConfig;
}

/**
 * Settings for the four extraction passes that run per component:
 * props/JSDoc (TypeScript), tv() variants, authored documentation, and
 * inherited interfaces.
 */
export interface ExtractionConfig {
  /** Props/JSDoc extraction via the TypeScript AST (and, with `configPath`, the shared ts.Program). */
  typescript: TypeScriptExtractionConfig;
  /** tv() variants-file extraction. */
  variants: VariantsExtractionConfig;
  /** Authored docs.svelte handling. */
  documentation: DocumentationExtractionConfig;
  /** Heritage-clause / inherited-interface resolution. */
  inheritance: InheritanceExtractionConfig;
}

/**
 * PropsExtractor settings. The extractor honours `extractJSDoc`,
 * `includePrivateProps`, and `configPath`; the remaining flags document the
 * intended contract and default to `true` in every preset.
 */
export interface TypeScriptExtractionConfig {
  /** Read JSDoc blocks + tags (`@default`, `@see`, `@deprecated`, `@example`, …) off each prop. Default `true`. */
  extractJSDoc: boolean;
  /** Follow type references when describing prop types. Default `true`. */
  extractTypeReferences: boolean;
  /** Capture prop default values (from `@default` tags). Default `true`. */
  extractDefaultValues: boolean;
  /** Resolve type aliases to their underlying shape where possible. Default `true`. */
  resolveTypeAliases: boolean;
  /** Include `_`-prefixed props; when `false` (default) they are skipped as private. */
  includePrivateProps?: boolean;
  /**
   * Path to the package's `tsconfig.json` (absolute, or relative to the
   * docs-gen CWD). When set, the TypeScript extractors build a real
   * `ts.Program` from it (shared per configPath across all extractors) and
   * resolve cross-file types — imported `*Props` bases in heritage clauses,
   * `Omit<ImportedProps, …>` patterns, and type-only imports — from the
   * package **sources**. When omitted, extraction stays single-file
   * (isolated `ts.createSourceFile`), as before.
   *
   * Authored on `input.typescript` (`TypeScriptConfig.configPath`) by the
   * `ConfigurationFactory` presets; the pipeline merges it into this
   * extraction config before handing it to the `ExtractorFactory`.
   */
  configPath?: string;
}

/**
 * VariantsExtractor settings. `frameworks` gates which variant syntaxes the
 * extractor attempts; this repo's custom `tv()` engine parses under the
 * `tailwind-variants` entry (compatible call shape).
 */
export interface VariantsExtractionConfig {
  /** Variant syntaxes to detect, tried in order. Presets use `['tailwind-variants']`. */
  frameworks: VariantFramework[];
  /** Capture each variant axis's `defaultVariants` value. Default `true`. */
  extractDefaults: boolean;
  /** Also surface computed/compound variants. Not consumed by the current extractor. */
  includeComputed?: boolean;
  /** Additional user-supplied variant parsers. Not consumed by the current extractor. */
  customParsers?: CustomParserConfig[];
}

/**
 * Variant syntax families the extractor knows how to detect. Only
 * `tailwind-variants` has a parser today (it also matches this repo's own
 * `tv()` engine); the rest are declared extension points.
 */
export type VariantFramework = 'tailwind-variants' | 'stitches' | 'vanilla-extract' | 'custom';

/**
 * A user-supplied variant parser: a detection pattern plus the module path of
 * the parsing function. Declared extension point — not consumed by the
 * current VariantsExtractor.
 */
export interface CustomParserConfig {
  /** Parser identifier (for logs and de-duplication). */
  name: string;
  /** Source pattern whose match routes a file to this parser. */
  pattern: string | RegExp;
  /** Path to the module exporting the parser function. */
  parser: string;
}

/**
 * Authored-documentation (docs.svelte) handling. Currently declarative: the
 * `SvelteDocsParser` always validates statically and fails loud on a present
 * but unreadable config, regardless of these flags.
 */
export interface DocumentationExtractionConfig {
  /** Validate authored docs configs against the schema. */
  validateSchema: boolean;
  /** Tolerate components whose docs.svelte covers only some sections. */
  allowPartialDocs: boolean;
}

/**
 * InheritanceExtractor settings: how far heritage clauses are followed and
 * which external interfaces are summarised instead of enumerated.
 */
export interface InheritanceExtractionConfig {
  /** Resolve interfaces imported from other files/packages (vs. reporting only the name). Default `true`. */
  resolveExternalTypes: boolean;
  /** Include the `HTMLAttributes`/DOM-attribute interfaces in inheritance output. Default `true`. */
  includeHTMLAttributes: boolean;
  /** Recursion cap for heritage chains; the extractor warns and stops at this depth. Presets use `5`. */
  maxDepth: number;
  /** Well-known external interfaces resolved to a curated summary + docs URL instead of member enumeration. */
  knownInterfaces?: KnownInterfaceConfig[];
}

/**
 * A curated entry for a well-known external interface (e.g. Svelte's
 * `HTMLButtonAttributes`): where it comes from and where its docs live.
 * The InheritanceExtractor prefers these over walking foreign declarations.
 */
export interface KnownInterfaceConfig {
  /** Interface name as it appears in heritage clauses. */
  name: string;
  /** Package that declares the interface. */
  package: string;
  /** Documentation URL surfaced next to the inherited block. */
  url?: string;
  /** Short human-readable summary of the interface. */
  description?: string;
}

/**
 * Phase 3 (enrichment) settings. Currently declarative: `APIDataGenerator`
 * always computes stats and type links; these switches document the intended
 * contract for a configurable enrichment pass.
 */
export interface EnrichmentConfig {
  /** Cross-reference resolution between components/types. */
  crossReferences: CrossReferenceConfig;
  /** Derived metadata (stats, complexity, tags). */
  metadata: MetadataEnrichmentConfig;
}

/**
 * Cross-reference resolution settings (component ↔ type links). Declared for
 * the enrichment contract; not consumed by the current pipeline.
 */
export interface CrossReferenceConfig {
  /** Master switch for cross-referencing. */
  enabled: boolean;
  /** Also link types from external packages. */
  includeExternal: boolean;
}

/**
 * Derived-metadata enrichment settings. Declared for the enrichment
 * contract; `APIDataGenerator` currently computes per-component stats
 * unconditionally.
 */
export interface MetadataEnrichmentConfig {
  /** Compute per-component stats (prop counts by source). */
  extractStats: boolean;
  /** Compute a complexity score per component. */
  calculateComplexity: boolean;
  /** Extra tags stamped onto every component. */
  addTags?: string[];
  /** Assign tier levels automatically from component shape. */
  autoTierAssignment?: boolean;
}

// ==========================================
// DOCS-GEN SPECIFIC VALIDATION CONFIG TYPES
// ==========================================

/**
 * Schema-validation switch for extracted data, plus custom rules. The preset
 * default is `enabled: true, failOnError: false` (report, don't abort).
 */
export interface SchemaValidationConfig {
  /** Master switch for schema validation. */
  enabled: boolean;
  /** Abort the run on schema errors instead of reporting them. */
  failOnError: boolean;
  /** Additional validation rules beyond the built-in schema checks. */
  customRules?: ValidationRule[];
}

/**
 * Per-component validation requirements (e.g. "every component must document
 * `children`"). Empty in all presets — declared for consumer configs.
 */
export interface ComponentValidationConfig {
  /** Prop names every component must expose. */
  requiredProps?: string[];
  /** Documentation sections every component must author. */
  requiredSections?: string[];
}

/**
 * Batched parallel extraction. `ExtractionCoordinator` splits the manifest
 * list into batches of `maxConcurrency` and awaits each batch; when disabled
 * it extracts sequentially (which also makes the ErrorHandler fail-fast — see
 * `PipelineOrchestrator`'s constructor).
 */
export interface ParallelConfig {
  /** Master switch for batched extraction. */
  enabled: boolean;
  /** Components per batch. The coordinator falls back to `4` when unset. */
  maxConcurrency?: number;
}

/**
 * Phase 4 (generation) targets: the LLM artifacts (llm.txt tree + manifests)
 * and the API artifacts (per-component api.ts / aggregate file).
 */
export interface OutputConfig {
  /** LLM documentation output (per-component `llm.txt` + `llms.txt` manifests). */
  llm: LLMOutputConfig;
  /** API data output (per-component `api.ts` or a single aggregate file). */
  api: APIOutputConfig;
}

/**
 * LLM documentation target. The load-bearing switch is the `outputPath`
 * extension: an extension-less path selects directory mode — a per-component
 * `<group>/<slug>/llm.txt` tree plus a per-scope `llms.txt` manifest and the
 * global static-root aggregator — while a file path emits one aggregate
 * document in `format`.
 */
export interface LLMOutputConfig {
  /** Master switch; `GenerationCoordinator` skips the LLM phase when `false`. */
  enabled: boolean;
  /** Output directory (no extension → per-component tree) or single-file path. Required when enabled. */
  outputPath: string;
  /** Aggregate-file format; ignored in directory mode (always llm.txt markdown-ish text). */
  format: LLMFormat;
  /** Guide documents copied into the output directory and indexed in the per-scope `llms.txt`. Directory mode only. */
  guides?: LLMGuideConfig[];
  /** Token-budget optimisations. Not consumed by the current generator. */
  optimization?: LLMOptimizationConfig;
}

/**
 * A hand-written guide document copied verbatim into the LLM output directory
 * and indexed under a "Guides" section of the per-scope `llms.txt`. The source
 * of truth stays where the file lives (typically the package's own `docs/`,
 * shipped in its npm tarball) — this is distribution, not duplication. See
 * docs/DOCS-SURFACES.md for the documentation-flow model.
 */
export interface LLMGuideConfig {
  /** Index-entry link title. */
  title: string;
  /** Source markdown path, resolved like `outputPath` (relative to the generator cwd). */
  sourcePath: string;
  /** File name written into the output directory (e.g. `AUTH.md`). */
  outputName: string;
  /** One-line index-entry description. */
  description: string;
}

/**
 * Single-file LLM output formats: `markdown` (headings + tables), `text`
 * (markdown with heading markers stripped), or `json` (structured payload).
 */
export type LLMFormat = 'markdown' | 'text' | 'json';

/**
 * Token-budget optimisations for aggregate LLM output. Declared for the
 * output contract; not consumed by the current generator.
 */
export interface LLMOptimizationConfig {
  /** Soft token budget for the whole document. */
  tokenLimit?: number;
  /** Shorten example code blocks. */
  compressExamples?: boolean;
  /** Replace oversized type definitions with summaries. */
  summarizeComplex?: boolean;
  /** Prepend a quick-reference section. */
  includeQuickRef?: boolean;
}

/**
 * API data target. Like the LLM output, an extension-less `outputPath`
 * selects directory mode: one typed `api.ts` per component under
 * `<group>/<slug>/`, which is what the docs app imports on every page.
 */
export interface APIOutputConfig {
  /** Master switch; `GenerationCoordinator` skips the API phase when `false`. */
  enabled: boolean;
  /** Output directory (per-component api.ts) or single-file path. Required when enabled. */
  outputPath: string;
  /** Emission format. Directory mode always emits TypeScript. */
  format: APIFormat;
  /** Output-size options; only `minify` is honoured (JSON format). */
  optimization?: APIOptimizationConfig;
}

/**
 * API artifact formats: `typescript` (typed `api.ts` modules), `json`, or
 * `yaml` (aggregate single-file mode only).
 */
export type APIFormat = 'typescript' | 'json' | 'yaml';

/**
 * API artifact size/layout options. `minify` collapses JSON output to a
 * single line; the remaining flags are declared extension points.
 */
export interface APIOptimizationConfig {
  /** Emit JSON without whitespace (JSON format only). */
  minify?: boolean;
  /** Compress the artifact. Not consumed by the current generator. */
  compress?: boolean;
  /** Split aggregate output per package. Not consumed by the current generator. */
  splitByPackage?: boolean;
  /** Emit an index over split outputs. Not consumed by the current generator. */
  generateIndex?: boolean;
}

/**
 * Debug/reporting settings. `enabled` gates the full error report on
 * partially-failed runs; `level` seeds the pipeline ErrorHandler's log level.
 */
export interface DebugConfig {
  /** Master switch; when `true`, warning-level pipeline completions print the full error report. */
  enabled: boolean;
  /** Log verbosity, also handed to the ErrorHandler (`trace` maps onto `debug` there). */
  level: DebugLevel;
  /** Where debug output goes. Not consumed by the current pipeline (console only). */
  output?: DebugOutputConfig;
}

/**
 * Log verbosity levels, most to least severe-only: `error` → `trace`.
 */
export type DebugLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

/**
 * Debug output routing (console/file/structured). Declared extension point;
 * the current pipeline logs to the console only.
 */
export interface DebugOutputConfig {
  /** Log to the console. */
  console: boolean;
  /** Also append to this file. */
  file?: string;
  /** Emit structured (JSON) records instead of formatted text. */
  structured?: boolean;
}

// ==========================================
// CONFIG BUILDER & FACTORY
// ==========================================

/**
 * Fluent builder contract for assembling a `GeneratorConfig`. Implemented by
 * `DocsConfigurationBuilder`, which starts from complete defaults so every
 * setter is an override, and whose `build()` runs `validate()` first.
 */
export interface GeneratorConfigBuilder {
  /** Add a package to scan (repeatable; at least one is required to build). */
  addPackage(config: PackageConfig): GeneratorConfigBuilder;

  /** Set the package TypeScript context (`configPath` → cross-file type resolution). */
  setTypeScript(config: TypeScriptConfig): GeneratorConfigBuilder;

  /** Override the docs schema expectations. */
  setSchema(config: SchemaConfig): GeneratorConfigBuilder;

  /** Override extraction settings (merged over the defaults). */
  setExtraction(config: ExtractionConfig): GeneratorConfigBuilder;

  /** Override enrichment settings (merged over the defaults). */
  setEnrichment(config: EnrichmentConfig): GeneratorConfigBuilder;

  /** Override validation settings (merged over the defaults). */
  setValidation(config: ValidationConfig): GeneratorConfigBuilder;

  /** Turn on batched parallel extraction (default concurrency 4). */
  enableParallel(config?: ParallelConfig): GeneratorConfigBuilder;

  /** Configure the LLM output target (merged over the defaults). */
  setLLMOutput(config: LLMOutputConfig): GeneratorConfigBuilder;

  /** Configure the API output target (merged over the defaults). */
  setAPIOutput(config: APIOutputConfig): GeneratorConfigBuilder;

  /** Turn on debug reporting at `info` level (or as overridden). */
  enableDebug(config?: DebugConfig): GeneratorConfigBuilder;

  /** Check the assembled config without building; returns all errors/warnings. */
  validate(): ConfigValidationResult;

  /** Validate and return the final config; throws on validation errors. */
  build(): GeneratorConfig;
}

/**
 * Result of validating an assembled configuration: overall verdict plus the
 * individual errors (blocking) and warnings (advisory).
 */
export interface ConfigValidationResult {
  /** `true` when there are no errors (warnings alone do not fail validation). */
  valid: boolean;
  /** Blocking problems; `build()` throws when any are present. */
  errors: ConfigError[];
  /** Advisory findings; logged by `build()` but never blocking. */
  warnings: ConfigWarning[];
}

/**
 * A blocking configuration problem, addressed by config path (e.g.
 * `input.packages`).
 */
export interface ConfigError {
  /** Dot-path of the offending config field. */
  path: string;
  /** What is wrong and what is required instead. */
  message: string;
  /** The offending value, when useful for diagnosis. */
  value?: unknown;
}

/**
 * An advisory configuration finding, addressed by config path, optionally
 * with a suggested improvement.
 */
export interface ConfigWarning {
  /** Dot-path of the config field the warning concerns. */
  path: string;
  /** What looks off. */
  message: string;
  /** Suggested improvement. */
  suggestion?: string;
}
