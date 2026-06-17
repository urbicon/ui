import type {
  APIData,
  EnrichedComponentInfo,
  GeneratedOutput,
  GenerationError,
  GenerationResult,
  OutputConfig
} from '../../types';
import { type ErrorHandler, withErrorHandling } from '../pipeline/ErrorHandler';

/**
 * Coordinates all generation operations (API, LLM)
 * Implements correct API-first dependency order
 */
export class GenerationCoordinator {
  private config: OutputConfig;

  constructor(
    config: OutputConfig,
    private errorHandler: ErrorHandler
  ) {
    this.config = config;
  }

  /**
   * Generate all outputs in correct dependency order (API first, then others)
   */
  async generateAll(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<GenerationResult> {
    console.log('📍 Phase 4: Generation');

    const outputs: GeneratedOutput[] = [];
    const errors: GenerationError[] = [];
    const startTime = Date.now();

    try {
      // 4a. Generate API file FIRST (other generators depend on this)
      if (this.config.api.enabled) {
        const apiOutput = await this.generateAPI(apiData);
        if (apiOutput) {
          outputs.push(apiOutput);
        }
      }

      // 4b. Generate LLM documentation
      if (this.config.llm.enabled) {
        const llmResult = await Promise.allSettled([this.generateLLM(enrichedComponents, apiData)]);

        for (const result of llmResult) {
          if (result.status === 'fulfilled' && result.value) {
            outputs.push(result.value);
          } else if (result.status === 'rejected') {
            errors.push({
              type: 'llm_generation_error',
              message: `Failed to generate LLM: ${result.reason}`
            });
          }
        }

        // 4c. Generate MCP catalog AFTER LLM (LLM cleans output dir first)
        const mcpResult = await this.generateMCPCatalog(enrichedComponents, apiData);
        if (mcpResult) outputs.push(mcpResult);
      }

      const duration = Date.now() - startTime;

      // Generate statistics
      const stats = this.generateStats(enrichedComponents, apiData, outputs);

      console.log(`✅ Generation completed in ${duration}ms`);
      console.log(`   📄 Generated ${outputs.length} output types`);

      return {
        success: errors.length === 0,
        outputs,
        errors,
        stats,
        duration
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      console.error(`❌ Generation failed: ${errorMessage}`);

      return {
        success: false,
        outputs,
        errors: [
          {
            type: 'generation_coordinator_error',
            message: errorMessage
          }
        ],
        stats: this.generateStats(enrichedComponents, apiData, outputs),
        duration
      };
    }
  }

  // ==========================================
  // INDIVIDUAL GENERATORS
  // ==========================================

  /**
   * Generate API file (must be first)
   */
  private async generateAPI(apiData: APIData): Promise<GeneratedOutput | null> {
    return withErrorHandling(
      async () => {
        console.log('  📄 Generating API file...');

        const { APIFileGenerator } = await import('../../generators/api/APIFileGenerator');
        const apiGenerator = new APIFileGenerator(this.config.api);

        // Validate API data before generation
        apiGenerator.validateAPIData(apiData);

        // Create backup if file exists
        await apiGenerator.createBackup();

        // Report changes
        await apiGenerator.reportChanges(apiData);

        // Generate the API file
        const apiOutput = await apiGenerator.generate(apiData);

        console.log(
          `  ✅ API file generated: ${apiOutput.path} (${Math.round(apiOutput.size / 1024)}KB)`
        );

        return apiOutput;
      },
      this.errorHandler,
      {
        phase: 'generation',
        operation: 'api_generation',
        filePath: this.config.api.outputPath
      }
    );
  }

  /**
   * Generate LLM documentation
   */
  private async generateLLM(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<GeneratedOutput | null> {
    return withErrorHandling(
      async () => {
        console.log('  🤖 Generating LLM documentation...');

        const { LLMDocumentationGenerator } = await import(
          '../../generators/llm/LLMDocumentationGenerator'
        );
        const llmGenerator = new LLMDocumentationGenerator(this.config.llm);
        const llmOutput = await llmGenerator.generate(enrichedComponents, apiData);

        console.log(
          `  ✅ LLM documentation generated: ${llmOutput.path} (${Math.round(llmOutput.size / 1024)}KB)`
        );

        return llmOutput;
      },
      this.errorHandler,
      {
        phase: 'generation',
        operation: 'llm_generation',
        filePath: this.config.llm.outputPath
      }
    );
  }

  /**
   * Generate MCP catalog (per-package component entries)
   */
  private async generateMCPCatalog(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<GeneratedOutput | null> {
    return withErrorHandling(
      async () => {
        console.log('  📦 Generating MCP catalog entries...');

        const { MCPCatalogGenerator } = await import('../../generators/mcp/MCPCatalogGenerator');

        // Infer package name from the first component's package info
        const firstComp = enrichedComponents[0];
        const packageName = firstComp?.packageName || '@urbicon-ui/blocks';

        const generator = new MCPCatalogGenerator(packageName, this.config.llm.outputPath);
        const result = await generator.generate(enrichedComponents, apiData);

        console.log(`  ✅ MCP catalog generated: ${result.path} (${result.count} entries)`);

        return {
          type: 'api' as const,
          path: result.path,
          size: 0,
          components: enrichedComponents.map((c) => c.name)
        };
      },
      this.errorHandler,
      {
        phase: 'generation',
        operation: 'mcp_catalog_generation',
        filePath: this.config.llm.outputPath
      }
    );
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Generate comprehensive generation statistics
   */
  private generateStats(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData,
    outputs: GeneratedOutput[]
  ) {
    const totalProps = Object.values(apiData.components).reduce(
      (sum, comp) => sum + comp.props.length,
      0
    );

    return {
      totalComponents: enrichedComponents.length,
      totalProps,
      apiDataSize: outputs.find((o) => o.type === 'api')?.size || 0
    };
  }

  /**
   * Validate generation configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate API config if enabled
    if (this.config.api.enabled) {
      if (!this.config.api.outputPath) {
        errors.push('API output path is required when API generation is enabled');
      }
    }

    // Validate LLM config if enabled
    if (this.config.llm.enabled) {
      if (!this.config.llm.outputPath) {
        errors.push('LLM output path is required when LLM generation is enabled');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get generation plan (useful for dry-run or debugging)
   */
  getGenerationPlan(): {
    phases: Array<{
      name: string;
      enabled: boolean;
      dependencies: string[];
      outputs: string[];
    }>;
    totalOutputs: number;
  } {
    const phases = [
      {
        name: 'API Generation',
        enabled: this.config.api.enabled,
        dependencies: [],
        outputs: this.config.api.enabled ? [this.config.api.outputPath] : []
      },
      {
        name: 'LLM Generation',
        enabled: this.config.llm.enabled,
        dependencies: ['API Generation'],
        outputs: this.config.llm.enabled ? [this.config.llm.outputPath] : []
      }
    ];

    const totalOutputs = phases.reduce((sum, phase) => sum + phase.outputs.length, 0);

    return { phases, totalOutputs };
  }
}
