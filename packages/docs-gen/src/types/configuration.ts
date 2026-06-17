import type { ValidationConfig, ValidationRule } from './validation';

export interface GeneratorConfig {
  input: InputConfig;
  processing: ProcessingConfig;
  output: OutputConfig;
  watch?: WatchConfig;
  debug?: DebugConfig;
}

export interface InputConfig {
  packages: PackageConfig[];
  schema: SchemaConfig;
  typescript?: TypeScriptConfig;
}

export interface PackageConfig {
  name: string;
  path: string;
  glob: GlobConfig;
  include?: string[];
  exclude?: string[];
  priority?: number;
  metadata?: PackageMetadata;
}

export interface GlobConfig {
  components: string;
  variants?: string;
  documentation?: string;
  tests?: string;
}

export interface PackageMetadata {
  displayName?: string;
  description?: string;
  homepage?: string;
  repository?: string;
  tags?: string[];
}

export interface SchemaConfig {
  version: string;
  strict?: boolean;
  allowUnknownSections?: boolean;
  migration?: MigrationConfig;
}

export interface MigrationConfig {
  enabled: boolean;
  fromVersion?: string;
  backupOriginal?: boolean;
  logChanges?: boolean;
}

export interface TypeScriptConfig {
  configPath?: string;
  compilerOptions?: Record<string, unknown>;
  include?: string[];
  exclude?: string[];
}

export interface ProcessingConfig {
  extraction: ExtractionConfig;
  enrichment: EnrichmentConfig;
  validation: ValidationConfig;
  parallel?: ParallelConfig;
}

export interface ExtractionConfig {
  typescript: TypeScriptExtractionConfig;
  variants: VariantsExtractionConfig;
  documentation: DocumentationExtractionConfig;
  inheritance: InheritanceExtractionConfig;
}

export interface TypeScriptExtractionConfig {
  extractJSDoc: boolean;
  extractTypeReferences: boolean;
  extractDefaultValues: boolean;
  resolveTypeAliases: boolean;
  includePrivateProps?: boolean;
}

export interface VariantsExtractionConfig {
  frameworks: VariantFramework[];
  extractDefaults: boolean;
  includeComputed?: boolean;
  customParsers?: CustomParserConfig[];
}

export type VariantFramework = 'tailwind-variants' | 'stitches' | 'vanilla-extract' | 'custom';

export interface CustomParserConfig {
  name: string;
  pattern: string | RegExp;
  parser: string; // Path to parser function
}

export interface DocumentationExtractionConfig {
  validateSchema: boolean;
  allowPartialDocs: boolean;
  // Remove reference to DocumentationSettings for now
  // defaultSettings?: Partial<import('./core').DocumentationSettings>;
}

export interface InheritanceExtractionConfig {
  resolveExternalTypes: boolean;
  includeHTMLAttributes: boolean;
  maxDepth: number;
  knownInterfaces?: KnownInterfaceConfig[];
}

export interface KnownInterfaceConfig {
  name: string;
  package: string;
  url?: string;
  description?: string;
}

export interface EnrichmentConfig {
  crossReferences: CrossReferenceConfig;
  metadata: MetadataEnrichmentConfig;
}

export interface CrossReferenceConfig {
  enabled: boolean;
  includeExternal: boolean;
  knownTypes?: KnownTypeConfig[];
}

export interface KnownTypeConfig {
  name: string;
  package: string;
  url?: string;
  category?: string;
}

export interface MetadataEnrichmentConfig {
  extractStats: boolean;
  calculateComplexity: boolean;
  addTags?: string[];
  autoTierAssignment?: boolean;
}

// ==========================================
// DOCS-GEN SPECIFIC VALIDATION CONFIG TYPES
// ==========================================

export interface SchemaValidationConfig {
  enabled: boolean;
  failOnError: boolean;
  customRules?: ValidationRule[];
}

// Example validation removed in hybrid architecture

export interface ComponentValidationConfig {
  requiredProps?: string[];
  requiredSections?: string[];
}

export interface ParallelConfig {
  enabled: boolean;
  maxConcurrency?: number;
  strategy?: 'package' | 'component' | 'auto';
}

export interface OutputConfig {
  llm: LLMOutputConfig;
  api: APIOutputConfig;
  shared?: SharedOutputConfig;
}

export interface LLMOutputConfig {
  enabled: boolean;
  outputPath: string;
  format: LLMFormat;
  filtering?: LLMFilterConfig;
  optimization?: LLMOptimizationConfig;
}

export type LLMFormat = 'markdown' | 'text' | 'json';

export interface LLMFilterConfig {
  maxComponents?: number;
  maxExamplesPerComponent?: number;
  includeTiers?: number[];
  excludeExperimental?: boolean;
}

export interface LLMOptimizationConfig {
  tokenLimit?: number;
  compressExamples?: boolean;
  summarizeComplex?: boolean;
  includeQuickRef?: boolean;
}

export interface APIOutputConfig {
  enabled: boolean;
  outputPath: string;
  format: APIFormat;
  inclusion?: APIInclusionConfig;
  optimization?: APIOptimizationConfig;
}

export type APIFormat = 'typescript' | 'json' | 'yaml';

export interface APIInclusionConfig {
  includeExamples: boolean;
  includeInherited: boolean;
  includeExperimental: boolean;
  includeStats: boolean;
}

export interface APIOptimizationConfig {
  minify?: boolean;
  compress?: boolean;
  splitByPackage?: boolean;
  generateIndex?: boolean;
}

export interface SharedOutputConfig {
  clean: boolean;
  createDirectories: boolean;
  overwrite: boolean;
  backup?: BackupConfig;
}

export interface BackupConfig {
  enabled: boolean;
  directory?: string;
  keepCount?: number;
  timestamp?: boolean;
}

export interface WatchConfig {
  enabled: boolean;
  debounce: number;
  include?: string[];
  exclude?: string[];
  events?: WatchEvent[];
  hooks?: WatchHooks;
}

export type WatchEvent = 'add' | 'change' | 'unlink' | 'addDir' | 'unlinkDir';

export interface WatchHooks {
  beforeRebuild?: string; // Path to hook function
  afterRebuild?: string;
  onError?: string;
}

export interface DebugConfig {
  enabled: boolean;
  level: DebugLevel;
  output?: DebugOutputConfig;
  profiling?: ProfilingConfig;
}

export type DebugLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace';

export interface DebugOutputConfig {
  console: boolean;
  file?: string;
  structured?: boolean;
}

export interface ProfilingConfig {
  enabled: boolean;
  outputPath?: string;
  includeMemory?: boolean;
  sampleRate?: number;
}

// ==========================================
// CONFIG BUILDER & FACTORY
// ==========================================

export interface GeneratorConfigBuilder {
  // Input configuration
  addPackage(config: PackageConfig): GeneratorConfigBuilder;

  setTypeScript(config: TypeScriptConfig): GeneratorConfigBuilder;

  setSchema(config: SchemaConfig): GeneratorConfigBuilder;

  // Processing configuration
  setExtraction(config: ExtractionConfig): GeneratorConfigBuilder;

  setEnrichment(config: EnrichmentConfig): GeneratorConfigBuilder;

  setValidation(config: ValidationConfig): GeneratorConfigBuilder;

  enableParallel(config?: ParallelConfig): GeneratorConfigBuilder;

  // Output configuration
  setLLMOutput(config: LLMOutputConfig): GeneratorConfigBuilder;

  setAPIOutput(config: APIOutputConfig): GeneratorConfigBuilder;

  // Additional features
  enableWatch(config?: WatchConfig): GeneratorConfigBuilder;

  enableDebug(config?: DebugConfig): GeneratorConfigBuilder;

  // Build & validate
  validate(): ConfigValidationResult;

  build(): GeneratorConfig;
}

export interface ConfigValidationResult {
  valid: boolean;
  errors: ConfigError[];
  warnings: ConfigWarning[];
}

export interface ConfigError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ConfigWarning {
  path: string;
  message: string;
  suggestion?: string;
}
