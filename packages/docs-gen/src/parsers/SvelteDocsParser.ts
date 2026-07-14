import * as fs from 'node:fs/promises';
import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
import { isValidSvelteDocsConfig, mergeWithSvelteDocsDefaults } from '../types';
import { parseDocsConfigFromSvelte } from './static-docs-config';

/**
 * Result from parsing a docs.svelte file
 */
export interface SvelteDocsParseResult {
  /** Configuration exported from the docs.svelte file */
  docsConfig: SvelteDocsConfig;
  /** Custom sections parsed from template */
  sections: [];
  /** Whether the file exists and was successfully parsed */
  exists: boolean;
  /** Any parsing errors encountered */
  errors: string[];
  /** Warnings about the configuration */
  warnings: string[];
}

/**
 * Simplified parser for docs.svelte files
 * Focuses exclusively on extracting the exported docsConfig.
 * Section parsing has been removed intentionally to reduce complexity.
 */
export class SvelteDocsParser {
  /**
   * Parse a docs.svelte file for a component
   * @param componentName Name of the component
   * @param docsFilePath Optional path to the docs file (if not provided, returns defaults)
   */
  async parseDocsFile(
    componentName: string,
    docsFilePath?: string
  ): Promise<SvelteDocsParseResult> {
    console.log(`📄 SvelteDocsParser: Parsing docs for ${componentName}`);

    // If no docs file provided, return defaults immediately
    if (!docsFilePath) {
      console.log(
        `📄 SvelteDocsParser: No docs file provided for ${componentName} - using defaults`
      );
      return {
        docsConfig: mergeWithSvelteDocsDefaults({}),
        sections: [],
        exists: false,
        errors: [],
        warnings: []
      };
    }

    console.log(`📄 SvelteDocsParser: Using docs file: ${docsFilePath}`);

    try {
      // Read the file content
      const content = await fs.readFile(docsFilePath, 'utf-8');
      console.log(`📄 SvelteDocsParser: Found docs.svelte, content length: ${content.length}`);

      // Extract docsConfig from content
      const docsConfig = this.extractDocsConfig(content, docsFilePath);
      console.log(`📄 SvelteDocsParser: Extracted docsConfig:`, docsConfig);

      // Validate the configuration
      const validation = this.validateConfig(docsConfig);

      return {
        docsConfig: mergeWithSvelteDocsDefaults(docsConfig),
        sections: [], // Section parsing intentionally removed
        exists: true,
        errors: validation.errors,
        warnings: validation.warnings
      };
    } catch (error) {
      console.error(`📄 SvelteDocsParser: Error parsing ${docsFilePath}:`, error);
      return {
        docsConfig: mergeWithSvelteDocsDefaults({}),
        sections: [],
        exists: true, // File exists but has parsing errors
        errors: [
          `Failed to parse docs.svelte: ${error instanceof Error ? error.message : String(error)}`
        ],
        warnings: []
      };
    }
  }

  // ==========================================
  // DOCS CONFIG EXTRACTION
  // ==========================================

  /**
   * Extract `export const docsConfig` from the file's script block.
   *
   * Folds the object literal off the TypeScript AST — no code is executed. A
   * config that is present but not statically evaluable throws (with
   * file:line:column) rather than degrading to `{}`; the caller reports it via
   * `SvelteDocsParseResult.errors`. An *absent* export is not an error: the
   * component simply takes the documented defaults.
   */
  private extractDocsConfig(content: string, docsFilePath: string): SvelteDocsConfig {
    console.log(`🔍 SvelteDocsParser: Extracting docsConfig from content`);

    const config = parseDocsConfigFromSvelte(content, docsFilePath);

    if (config === null) {
      console.log(`🔍 SvelteDocsParser: No docsConfig export found`);
      return {} as SvelteDocsConfig;
    }

    return config as SvelteDocsConfig;
  }

  // ==========================================
  // VALIDATION
  // ==========================================

  /**
   * Validate docs configuration
   */
  private validateConfig(config: SvelteDocsConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    if (!isValidSvelteDocsConfig(config)) {
      errors.push('Invalid docs configuration structure');
    }

    // Check for common issues
    if (
      config.generation?.playground?.featured &&
      config.generation.playground.featured.length === 0
    ) {
      warnings.push('Playground featured array is empty - consider removing or adding props');
    }

    if (config.generation?.variants?.exclude && config.generation.variants.exclude.length > 5) {
      warnings.push('Many variants excluded - consider reviewing variant design');
    }

    // Suggestions for better docs
    if (!config.meta?.description) {
      suggestions.push('Consider adding a component description for better documentation');
    }

    if (config.llm?.include === undefined) {
      suggestions.push(
        'Consider explicitly setting llm.include to control LLM documentation generation'
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }
}
