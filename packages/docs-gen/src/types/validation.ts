/**
 * Validation result
 */
export interface ValidationResult {
  /** Validation success status */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
  /** Validation metadata */
  metadata?: ValidationMetadata;
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error type/category */
  type: string;
  /** Error message */
  message: string;
  /** Field or location of error */
  field?: string;
  /** Error value */
  value?: unknown;
  /** Error severity */
  severity?: 'error' | 'critical';
  /** Source location */
  location?: SourceLocation;
  /** Error context */
  context?: unknown;
  /** Suggested fix */
  suggestion?: string;
  /** Error code for programmatic handling */
  code?: string;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning type/category */
  type: string;
  /** Warning message */
  message: string;
  /** Field or location of warning */
  field?: string;
  /** Warning value */
  value?: unknown;
  /** Source location */
  location?: SourceLocation;
  /** Warning context */
  context?: unknown;
  /** Suggested improvement */
  suggestion?: string;
  /** Warning code for programmatic handling */
  code?: string;
  /** Warning category */
  category?: 'performance' | 'accessibility' | 'best-practice' | 'syntax' | 'style';
}

/**
 * Validation metadata
 */
export interface ValidationMetadata {
  /** Validation timestamp */
  timestamp: string;
  /** Validator version */
  version: string;
  /** Source file being validated */
  sourceFile?: string;
  /** Validation duration (ms) */
  duration?: number;
  /** Validation context */
  context?: ValidationContext;
  /** Validation statistics */
  stats?: ValidationStats;
}

/**
 * Validation context
 */
export interface ValidationContext {
  /** Component being validated */
  component?: string;
  /** Package context */
  package?: string;
  /** Environment context */
  environment?: string;
  /** Dependency versions */
  dependencies?: Record<string, string>;
  /** Validation configuration */
  config?: ValidationConfig;
}

/**
 * Validation statistics
 */
export interface ValidationStats {
  /** Total items validated */
  totalChecks: number;
  /** Number of errors found */
  errorCount: number;
  /** Number of warnings found */
  warningCount: number;
  /** Validation coverage percentage */
  coverage?: number;
  /** Performance metrics */
  performance?: {
    checkDuration: number;
    memoryUsage?: number;
  };
}

/**
 * Source location information
 */
export interface SourceLocation {
  /** File path */
  file: string;
  /** Line number */
  line: number;
  /** Column number */
  column: number;
  /** Length of the problematic text */
  length?: number;
  /** Offset from start of file */
  offset?: number;
  /** End line (for multi-line issues) */
  endLine?: number;
  /** End column (for multi-line issues) */
  endColumn?: number;
}

/**
 * Validation configuration
 */
export interface ValidationConfig {
  /** Validation rules to enable */
  rules: ValidationRule[];
  /** Strict mode settings */
  strict?: boolean;
  /** Fail on warnings */
  failOnWarnings?: boolean;
  /** Maximum allowed errors */
  maxErrors?: number;
  /** Validation scope */
  scope?: ValidationScope;
  /** Custom validators */
  customValidators?: CustomValidator[];
  /** Schema validation configuration (from docs-gen) */
  schema?: Record<string, unknown>; // Allow any shape for docs-gen compatibility
  /** Example validation configuration (from docs-gen) */
  examples?: Record<string, unknown>; // Allow any shape for docs-gen compatibility
  /** Component validation configuration (from docs-gen) */
  components?: Record<string, unknown>; // Allow any shape for docs-gen compatibility
  /** Strict mode (docs-gen alias for strict) */
  strictMode?: boolean;
}

/**
 * Validation rule configuration
 */
export interface ValidationRule {
  /** Rule identifier */
  id: string;
  /** Rule name */
  name: string;
  /** Rule enabled status */
  enabled: boolean;
  /** Rule severity level */
  severity: 'error' | 'warning' | 'info';
  /** Rule options */
  options?: Record<string, unknown>;
  /** Rule description */
  description?: string;
  /** Path to validation function */
  rule?: string;
  /** Custom error message */
  message?: string;
}

/**
 * Validation scope
 */
export interface ValidationScope {
  /** Files to include */
  include?: string[];
  /** Files to exclude */
  exclude?: string[];
  /** Components to validate */
  components?: string[];
  /** Validation types to run */
  types?: ValidationType[];
}

/**
 * Validation types
 */
export type ValidationType =
  | 'syntax'
  | 'schema'
  | 'examples'
  | 'components'
  | 'accessibility'
  | 'performance'
  | 'types'
  | 'links'
  | 'images'
  | 'custom';

/**
 * Custom validator
 */
export interface CustomValidator {
  /** Validator identifier */
  id: string;
  /** Validator name */
  name: string;
  /** Validator function */
  validate: ValidatorFunction;
  /** Validator options */
  options?: Record<string, unknown>;
  /** Validator description */
  description?: string;
}

/**
 * Validator function type
 */
export type ValidatorFunction = (
  input: unknown,
  context: ValidationContext
) => ValidationResult | Promise<ValidationResult>;

/**
 * Extraction result with validation
 * From: docs-gen/ExtractionResult
 */
export interface ExtractionResult<T = unknown> {
  /** Extraction success status */
  success: boolean;
  /** Extracted data */
  data?: T;
  /** Extraction errors */
  errors: ExtractionError[];
  /** Extraction warnings */
  warnings: ExtractionWarning[];
  /** Extraction metadata */
  metadata: ExtractionMetadata;
}

/**
 * Extraction error
 */
export interface ExtractionError {
  /** Error type */
  type: string;
  /** Error message */
  message: string;
  /** Source location */
  location?: SourceLocation;
  /** Error context */
  context?: unknown;
  /** Recovery suggestion */
  recovery?: string;
}

/**
 * Extraction warning
 */
export interface ExtractionWarning {
  /** Warning type */
  type: string;
  /** Warning message */
  message: string;
  /** Improvement suggestion */
  suggestion?: string;
  /** Source location */
  location?: SourceLocation;
}

/**
 * Extraction metadata
 */
export interface ExtractionMetadata {
  /** Extraction duration (ms) */
  duration: number;
  /** Extractor version */
  extractorVersion: string;
  /** Source file */
  sourceFile: string;
  /** Extraction timestamp */
  timestamp: string;
  /** Extraction context */
  context?: {
    component?: string;
    package?: string;
    environment?: string;
  };
}

/**
 * Validation report summary
 */
export interface ValidationReport {
  /** Overall validation status */
  status: 'passed' | 'failed' | 'warning';
  /** Summary statistics */
  summary: ValidationSummary;
  /** Validation results by file */
  results: Record<string, ValidationResult>;
  /** Report metadata */
  metadata: ValidationReportMetadata;
}

/**
 * Validation summary
 */
export interface ValidationSummary {
  /** Total files validated */
  totalFiles: number;
  /** Files with errors */
  filesWithErrors: number;
  /** Files with warnings */
  filesWithWarnings: number;
  /** Total errors */
  totalErrors: number;
  /** Total warnings */
  totalWarnings: number;
  /** Validation duration */
  duration: number;
}

/**
 * Validation report metadata
 */
export interface ValidationReportMetadata {
  /** Report generated timestamp */
  generated: string;
  /** Validator version */
  version: string;
  /** Validation configuration used */
  config: ValidationConfig;
  /** Environment information */
  environment: {
    nodeVersion?: string;
    platform?: string;
    cwd?: string;
  };
}
