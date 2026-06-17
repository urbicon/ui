import type { ExtractionError, ExtractionResult, ExtractionWarning } from '../types';

/**
 * Generic base class for all extractors (TypeScript and non-TypeScript)
 */
export abstract class BaseExtractor<TInput = unknown, TOutput = unknown> {
  protected config: unknown;

  constructor(config?: unknown) {
    this.config = config;
  }

  /**
   * Main extraction method - must be implemented by subclasses
   */
  abstract extract(input: TInput): Promise<ExtractionResult<TOutput>>;

  /**
   * Validate input before extraction - can be overridden
   */
  protected validateInput(input: TInput): boolean {
    return input !== null && input !== undefined;
  }

  /**
   * Handle extraction errors - can be overridden for custom error handling
   */
  protected handleError(error: unknown, context?: unknown): ExtractionResult<TOutput> {
    const extractionError: ExtractionError = {
      type: 'extraction_failed',
      message: error instanceof Error ? error.message : String(error),
      context
    };

    return {
      success: false,
      data: undefined as unknown as TOutput,
      errors: [extractionError],
      warnings: [],
      metadata: {
        duration: 0,
        extractorVersion: '2.0.0',
        sourceFile: (context as { sourceFile?: string } | undefined)?.sourceFile || 'unknown',
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Create a successful extraction result
   */
  protected createSuccessResult(
    data: TOutput,
    warnings: ExtractionWarning[] = [],
    sourceFile: string = 'unknown',
    duration: number = 0
  ): ExtractionResult<TOutput> {
    return {
      success: true,
      data,
      errors: [],
      warnings,
      metadata: {
        duration,
        extractorVersion: '2.0.0',
        sourceFile,
        timestamp: new Date().toISOString()
      }
    };
  }

  /**
   * Add warning to extraction result
   */
  protected addWarning(type: string, message: string, suggestion?: string): ExtractionWarning {
    const warning: ExtractionWarning = { type, message };
    return suggestion ? { ...warning, suggestion } : warning;
  }

  /**
   * Clear any caches (useful for watch mode)
   */
  clearCache(): void {
    // Override in subclasses if needed
  }
}
