import * as fs from 'node:fs/promises';
import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
import { isValidSvelteDocsConfig, mergeWithSvelteDocsDefaults } from '../types';

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
      const docsConfig = this.extractDocsConfig(content);
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
   * Extract export const docsConfig from script block using regex
   * Simplified approach focused on modern Svelte 5 syntax only
   */
  private extractDocsConfig(content: string): SvelteDocsConfig {
    console.log(`🔍 SvelteDocsParser: Extracting docsConfig from content`);

    try {
      // Find export const docsConfig = { ... }; pattern
      const typedPattern = /export\s+const\s+docsConfig\s*:\s*SvelteDocsConfig\s*=\s*({[\s\S]*?});/;
      const untypedPattern = /export\s+const\s+docsConfig\s*=\s*({[\s\S]*?});/;
      const match = content.match(typedPattern) || content.match(untypedPattern);

      if (!match) {
        console.log(`🔍 SvelteDocsParser: No docsConfig export found`);
        return {} as SvelteDocsConfig;
      }

      const configString = match[1] as string;
      console.log(
        `🔍 SvelteDocsParser: Found config string (first 200 chars):`,
        `${configString.substring(0, 200)}...`
      );

      // Parse the object literal
      const config = this.parseConfigObject(configString as string);
      return config;
    } catch (error) {
      console.warn(`🔍 SvelteDocsParser: Failed to extract docsConfig:`, error);
      return {} as SvelteDocsConfig;
    }
  }

  /**
   * Parse config object string into SvelteDocsConfig
   * Uses eval for object literals (safe in build context)
   */
  private parseConfigObject(configString: string): SvelteDocsConfig {
    try {
      // Use eval directly since we're in a controlled build environment
      // and the content comes from our own source files
      console.log(`🔍 SvelteDocsParser: Parsing config object with eval`);
      // biome-ignore lint/security/noGlobalEval: build-time parse of our own doc-config object literals, never runtime or user input (see above).
      return eval(`(${configString})`);
    } catch (evalError) {
      console.error(`🔍 SvelteDocsParser: Failed to parse config object:`, evalError);
      console.error(`🔍 SvelteDocsParser: Config string was:`, configString.substring(0, 300));
      return {} as SvelteDocsConfig;
    }
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
