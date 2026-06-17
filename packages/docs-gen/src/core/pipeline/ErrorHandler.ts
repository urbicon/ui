import type { ComponentInfo, ExtractionError, ExtractionWarning } from '../../types';

/**
 * Centralized error handling for the documentation pipeline
 */
export class ErrorHandler {
  private errors: PipelineError[] = [];
  private warnings: PipelineWarning[] = [];
  private context: ErrorContext = {};

  constructor(private options: ErrorHandlerOptions = {}) {
    this.options = {
      failFast: false,
      maxErrors: 100,
      logLevel: 'info',
      ...options
    };
  }

  // ==========================================
  // ERROR REPORTING
  // ==========================================

  /**
   * Report an error during pipeline execution
   */
  reportError(error: PipelineError): void {
    this.errors.push({
      ...error,
      timestamp: new Date().toISOString(),
      context: { ...this.context }
    });

    this.logError(error);

    // Check if we should fail fast
    if (this.options.failFast) {
      throw new PipelineException(error.message, error);
    }

    // Check if we've exceeded max errors
    if (this.errors.length >= this.options.maxErrors!) {
      throw new PipelineException(
        `Maximum error count exceeded (${this.options.maxErrors})`,
        this.errors[this.errors.length - 1]
      );
    }
  }

  /**
   * Report a warning during pipeline execution
   */
  reportWarning(warning: PipelineWarning): void {
    this.warnings.push({
      ...warning,
      timestamp: new Date().toISOString(),
      context: { ...this.context }
    });

    this.logWarning(warning);
  }

  /**
   * Convert extraction errors to pipeline errors
   */
  handleExtractionError(
    extractionError: ExtractionError,
    component?: ComponentInfo,
    phase?: string
  ): void {
    const pipelineError: PipelineError = {
      type: 'extraction_error',
      message: extractionError.message,
      originalError: extractionError,
      severity: 'error',
      recoverable: true
    };

    if (phase) pipelineError.phase = phase;
    else pipelineError.phase = 'extraction';
    if (component?.name) pipelineError.component = component.name;
    if (extractionError.location) pipelineError.location = extractionError.location;

    this.reportError(pipelineError);
  }

  /**
   * Convert extraction warnings to pipeline warnings
   */
  handleExtractionWarning(
    extractionWarning: ExtractionWarning,
    component?: ComponentInfo,
    phase?: string
  ): void {
    const pipelineWarning: PipelineWarning = {
      type: 'extraction_warning',
      message: extractionWarning.message,
      severity: 'warning'
    };
    if (phase) pipelineWarning.phase = phase;
    else pipelineWarning.phase = 'extraction';
    if (component?.name) pipelineWarning.component = component.name;
    if (extractionWarning.suggestion) pipelineWarning.suggestion = extractionWarning.suggestion;

    this.reportWarning(pipelineWarning);
  }

  // ==========================================
  // CONTEXT MANAGEMENT
  // ==========================================

  /**
   * Set context for error reporting
   */
  setContext(context: Partial<ErrorContext>): void {
    this.context = { ...this.context, ...context };
  }

  /**
   * Clear context
   */
  clearContext(): void {
    this.context = {};
  }

  /**
   * Execute code with temporary context
   */
  async withContext<T>(context: Partial<ErrorContext>, fn: () => Promise<T>): Promise<T> {
    const previousContext = { ...this.context };
    this.setContext(context);

    try {
      return await fn();
    } finally {
      this.context = previousContext;
    }
  }

  // ==========================================
  // ERROR RECOVERY
  // ==========================================

  async attemptRecovery(_error: PipelineError): Promise<boolean> {
    return false;
  }

  // ==========================================
  // REPORTING & SUMMARY
  // ==========================================

  /**
   * Get error summary
   */
  getSummary(): ErrorSummary {
    const errorsByType = this.groupErrorsByType();
    const errorsByComponent = this.groupErrorsByComponent();
    const errorsByPhase = this.groupErrorsByPhase();

    return {
      totalErrors: this.errors.length,
      totalWarnings: this.warnings.length,
      criticalErrors: this.errors.filter((e) => e.severity === 'critical').length,
      recoverableErrors: this.errors.filter((e) => e.recoverable).length,
      errorsByType,
      errorsByComponent,
      errorsByPhase,
      hasBlockingErrors: this.errors.some((e) => e.severity === 'critical' || !e.recoverable)
    };
  }

  /**
   * Check if pipeline can continue
   */
  canContinue(): boolean {
    const summary = this.getSummary();
    return !summary.hasBlockingErrors;
  }

  /**
   * Generate detailed error report
   */
  generateReport(): string {
    const summary = this.getSummary();
    const lines: string[] = [];

    lines.push('📊 Pipeline Error Report');
    lines.push('========================');
    lines.push('');

    if (summary.totalErrors === 0 && summary.totalWarnings === 0) {
      lines.push('✅ No errors or warnings reported');
      return lines.join('\n');
    }

    lines.push(`📊 Summary:`);
    lines.push(`  • Errors: ${summary.totalErrors} (${summary.criticalErrors} critical)`);
    lines.push(`  • Warnings: ${summary.totalWarnings}`);
    lines.push(`  • Recoverable: ${summary.recoverableErrors}`);
    lines.push('');

    if (summary.totalErrors > 0) {
      lines.push('❌ Errors by Type:');
      Object.entries(summary.errorsByType).forEach(([type, count]) => {
        lines.push(`  • ${type}: ${count}`);
      });
      lines.push('');

      lines.push('❌ Errors by Component:');
      Object.entries(summary.errorsByComponent).forEach(([component, count]) => {
        lines.push(`  • ${component || 'unknown'}: ${count}`);
      });
      lines.push('');

      lines.push('❌ Recent Errors:');
      this.errors.slice(-5).forEach((error) => {
        lines.push(`  • [${error.phase}] ${error.component || 'unknown'}: ${error.message}`);
      });
      lines.push('');
    }

    if (summary.totalWarnings > 0) {
      lines.push('⚠️  Recent Warnings:');
      this.warnings.slice(-5).forEach((warning) => {
        lines.push(`  • [${warning.phase}] ${warning.component || 'unknown'}: ${warning.message}`);
      });
    }

    return lines.join('\n');
  }

  // ==========================================
  // PRIVATE METHODS
  // ==========================================

  private logError(error: PipelineError): void {
    const prefix = error.component ? `[${error.component}]` : '[Pipeline]';
    const phaseInfo = error.phase ? ` (${error.phase})` : '';

    console.error(`❌ ${prefix}${phaseInfo} ${error.message}`);

    if (error.location && this.options.logLevel === 'debug') {
      console.error(`   📍 ${error.location.file}:${error.location.line}:${error.location.column}`);
    }
  }

  private logWarning(warning: PipelineWarning): void {
    const prefix = warning.component ? `[${warning.component}]` : '[Pipeline]';
    const phaseInfo = warning.phase ? ` (${warning.phase})` : '';

    console.warn(`⚠️  ${prefix}${phaseInfo} ${warning.message}`);

    if (warning.suggestion && this.options.logLevel !== 'error') {
      console.warn(`   💡 ${warning.suggestion}`);
    }
  }

  private groupErrorsByType(): Record<string, number> {
    const groups: Record<string, number> = {};
    this.errors.forEach((error) => {
      groups[error.type] = (groups[error.type] || 0) + 1;
    });
    return groups;
  }

  private groupErrorsByComponent(): Record<string, number> {
    const groups: Record<string, number> = {};
    this.errors.forEach((error) => {
      const component = error.component || 'unknown';
      groups[component] = (groups[component] || 0) + 1;
    });
    return groups;
  }

  private groupErrorsByPhase(): Record<string, number> {
    const groups: Record<string, number> = {};
    this.errors.forEach((error) => {
      const phase = error.phase || 'unknown';
      groups[phase] = (groups[phase] || 0) + 1;
    });
    return groups;
  }

  /**
   * Reset error state (useful for watch mode)
   */
  reset(): void {
    this.errors = [];
    this.warnings = [];
    this.context = {};
  }
}

// ==========================================
// TYPES & INTERFACES
// ==========================================

export interface PipelineError {
  type: string;
  phase?: string;
  component?: string;
  message: string;
  originalError?: unknown;
  severity: 'error' | 'critical';
  recoverable: boolean;
  location?: {
    file: string;
    line: number;
    column: number;
  };
  timestamp?: string;
  context?: ErrorContext;
}

export interface PipelineWarning {
  type: string;
  phase?: string;
  component?: string;
  message: string;
  suggestion?: string;
  severity: 'warning' | 'info';
  timestamp?: string;
  context?: ErrorContext;
}

export interface ErrorContext {
  packageName?: string;
  phase?: string;
  operation?: string;
  filePath?: string;

  [key: string]: unknown;
}

export interface ErrorHandlerOptions {
  failFast?: boolean;
  maxErrors?: number;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export interface ErrorSummary {
  totalErrors: number;
  totalWarnings: number;
  criticalErrors: number;
  recoverableErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsByPhase: Record<string, number>;
  hasBlockingErrors: boolean;
}

/**
 * Custom exception for pipeline failures
 */
export class PipelineException extends Error {
  constructor(
    message: string,
    public readonly pipelineError?: PipelineError
  ) {
    super(message);
    this.name = 'PipelineException';
  }
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Create a standard pipeline error
 */
export function createError(
  type: string,
  message: string,
  options: Partial<PipelineError> = {}
): PipelineError {
  return {
    type,
    message,
    severity: 'error',
    recoverable: true,
    ...options
  };
}

/**
 * Create a standard pipeline warning
 */
export function createWarning(
  type: string,
  message: string,
  options: Partial<PipelineWarning> = {}
): PipelineWarning {
  return {
    type,
    message,
    severity: 'warning',
    ...options
  };
}

/**
 * Wrap async operations with error handling
 */
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorHandler: ErrorHandler,
  context: Partial<ErrorContext> = {}
): Promise<T | null> {
  return errorHandler.withContext(context, async () => {
    try {
      return await operation();
    } catch (error) {
      const opts: Partial<PipelineError> = { originalError: error, recoverable: true };
      if (context.phase) opts.phase = context.phase as string;
      if (context.packageName) opts.component = context.packageName as string;
      const pipelineError = createError(
        'operation_failed',
        error instanceof Error ? error.message : String(error),
        opts
      );

      errorHandler.reportError(pipelineError);

      // Try to recover
      const recovered = await errorHandler.attemptRecovery(pipelineError);
      if (!recovered) {
        return null;
      }

      // Retry if recovery succeeded
      try {
        return await operation();
      } catch (retryError) {
        const retryOpts: Partial<PipelineError> = { recoverable: false };
        if (context.phase) retryOpts.phase = context.phase as string;
        if (context.packageName) retryOpts.component = context.packageName as string;
        errorHandler.reportError(
          createError(
            'recovery_retry_failed',
            `Retry after recovery failed: ${retryError instanceof Error ? retryError.message : String(retryError)}`,
            retryOpts
          )
        );
        return null;
      }
    }
  });
}
