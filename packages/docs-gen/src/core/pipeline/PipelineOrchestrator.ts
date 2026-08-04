import type { ComponentInfo } from '@urbicon-ui/shared-types';
import type {
  APIData,
  ComponentManifest,
  EnrichedComponentInfo,
  GenerationResult,
  GeneratorConfig
} from '../../types';
import {
  ErrorHandler,
  ExtractionCoordinator,
  GenerationCoordinator,
  PipelineException,
  withErrorHandling
} from '..';

/**
 * Main orchestrator for the documentation generation pipeline.
 * Coordinates all phases: Discovery → Extraction → Enrichment → Generation
 */
export class PipelineOrchestrator {
  private config: GeneratorConfig;
  private startTime: number = 0;
  private errorHandler: ErrorHandler;

  constructor(config: GeneratorConfig) {
    this.config = config;
    this.errorHandler = new ErrorHandler({
      // Strictness is enforced at the barrier below (any collected error fails the
      // run), NOT by fail-fast — so it must not be coupled to parallelism.
      // Previously `failFast: !parallel.enabled` meant turning parallelism on
      // silently stopped errors from reaching a non-zero exit (a performance
      // switch changing error strictness). Collect all errors (up to maxErrors),
      // then fail once at the end regardless of mode.
      failFast: false,
      maxErrors: 50,
      logLevel: (config.debug?.level as 'error' | 'warn' | 'info' | 'debug') || 'info'
    });
  }

  /**
   * Execute the complete documentation generation pipeline
   */
  async execute(): Promise<GenerationResult> {
    this.startTime = Date.now();
    this.errorHandler.reset();

    try {
      console.log('🚀 Starting documentation generation pipeline...');

      // Phase 1: Discovery
      const manifests = await withErrorHandling(() => this.discoveryPhase(), this.errorHandler, {
        phase: 'discovery'
      });

      if (!manifests || manifests.length === 0) {
        throw new PipelineException('No components discovered');
      }

      // Phase 2: Extraction
      const richComponents = await withErrorHandling(
        () => this.extractionPhase(manifests),
        this.errorHandler,
        { phase: 'extraction' }
      );

      if (!richComponents) {
        throw new PipelineException('Component extraction failed');
      }

      // Phase 3: Enrichment
      const enrichmentResult = await withErrorHandling(
        () => this.enrichmentPhase(richComponents),
        this.errorHandler,
        { phase: 'enrichment' }
      );

      if (!enrichmentResult) {
        throw new PipelineException('Component enrichment failed');
      }

      // Phase 4: Generation (API first, then others)
      const result = await withErrorHandling(
        () => this.generationPhase(enrichmentResult.enrichedComponents, enrichmentResult.apiData),
        this.errorHandler,
        { phase: 'generation' }
      );

      if (!result) {
        throw new PipelineException('Documentation generation failed');
      }

      // Check if we can continue despite errors
      if (!this.errorHandler.canContinue()) {
        console.error('❌ Pipeline completed with blocking errors');
        console.error(this.errorHandler.generateReport());
        return this.createErrorResult(new Error('Pipeline had blocking errors'));
      }

      const summary = this.errorHandler.getSummary();

      // Barrier: any error collected during the run fails it, regardless of
      // fail-fast / parallel mode. This is what keeps a parallel run as strict as
      // a serial one — an error logged but not rethrown mid-flight would otherwise
      // let a run with a missing artifact exit 0. Warnings do not fail the run.
      if (summary.totalErrors > 0) {
        console.error(
          `❌ Pipeline completed with ${summary.totalErrors} error(s) and ${summary.totalWarnings} warning(s)`
        );
        console.error(this.errorHandler.generateReport());
        return this.createErrorResult(
          new Error(`Pipeline completed with ${summary.totalErrors} error(s)`)
        );
      }

      if (summary.totalWarnings > 0) {
        console.warn(`⚠️  Pipeline completed with ${summary.totalWarnings} warning(s)`);
        if (this.config.debug?.enabled) {
          console.warn(this.errorHandler.generateReport());
        }
      } else {
        console.log('✅ Pipeline completed successfully');
      }

      return result;
    } catch (error) {
      console.error('❌ Pipeline failed:', error);
      console.error(this.errorHandler.generateReport());
      return this.createErrorResult(error);
    }
  }

  /**
   * Phase 1: Discovery - Find all components and their files
   */
  private async discoveryPhase(): Promise<ComponentManifest[]> {
    console.log('📍 Phase 1: Discovery');

    const { ComponentFinder } = await import('../discovery/ComponentFinder');
    const componentFinder = new ComponentFinder();

    const allManifests: ComponentManifest[] = [];

    for (const packageConfig of this.config.input.packages) {
      console.log(`  📦 Processing package: ${packageConfig.name}`);

      try {
        const manifests = await componentFinder.findComponents(packageConfig);
        allManifests.push(...manifests);

        console.log(`  ✅ Found ${manifests.length} components in ${packageConfig.name}`);

        // Validate each manifest
        for (const manifest of manifests) {
          const validation = await componentFinder.validateManifest(manifest);
          if (!validation.success) {
            console.warn(
              `  ⚠️  Validation issues for ${manifest.component.name}:`,
              validation.errors.map((e) => e.message).join(', ')
            );
          }
        }
      } catch (error) {
        console.error(`  ❌ Failed to process package ${packageConfig.name}:`, error);
        // Continue with other packages
      }
    }

    console.log(`  📊 Discovery complete: ${allManifests.length} total components`);
    return allManifests;
  }

  /**
   * Phase 2: Extraction - Extract props, variants, inheritance, docs
   */
  private async extractionPhase(manifests: ComponentManifest[]): Promise<ComponentInfo[]> {
    console.log('📍 Phase 2: Extraction');

    const extractionCoordinator = new ExtractionCoordinator(
      this.config.processing,
      this.errorHandler,
      // Carries the package's tsconfig path (configPath) into extraction —
      // the switch between single-file parsing and real cross-file resolution.
      this.config.input.typescript
    );

    const richComponents = await extractionCoordinator.extractAllComponents(manifests);

    // Display statistics
    const stats = extractionCoordinator.generateExtractionStats(richComponents);
    console.log(`  📊 Extraction statistics:`);
    console.log(`     Components: ${stats.totalComponents}`);
    console.log(
      `     Props: ${stats.totalProps} (avg: ${stats.averagePropsPerComponent}/component)`
    );
    console.log(`     Variants: ${stats.totalVariants}`);
    console.log(`     With Documentation: ${stats.componentsWithDocumentation}`);

    return richComponents;
  }

  /**
   * Phase 3: Enrichment - Add cross-references, validate examples, generate API data
   */
  private async enrichmentPhase(richComponents: ComponentInfo[]): Promise<{
    enrichedComponents: EnrichedComponentInfo[];
    apiData: APIData;
  }> {
    console.log('📍 Phase 3: Enrichment');

    // Could be moved into EnrichmentCoordinator, but it is already fairly clean
    const { APIDataGenerator } = await import('../enrichment/APIDataGenerator');

    // Create enriched components with basic stats for now
    const enrichedComponents: EnrichedComponentInfo[] = richComponents.map((component) => ({
      ...component,
      crossReferences: [],
      examples: [],
      stats: {
        totalProps: component.props.length,
        directProps: component.props.filter((p) => p.source.type === 'direct').length,
        variantProps: component.variants.length,
        inheritedProps: component.props.filter((p) => p.source.type === 'inherited').length
      }
    }));

    // Generate API data using APIDataGenerator
    console.log('  📊 Generating API data...');
    const apiDataGenerator = new APIDataGenerator();
    const apiData = await apiDataGenerator.generate(richComponents, {
      routeBasePath: this.deriveRouteBasePath(),
      // The on-disk twin of the base above, so cross-links can be checked
      // against the routes that actually exist — see `hasDocPage`.
      routeOutputPath: this.config.output.api?.outputPath ?? ''
    });

    console.log(
      `  ✅ Enrichment complete: ${enrichedComponents.length} components, ${apiData.metadata.totalProps} total props`
    );
    // Harmonize stats: prefer API data (single source of truth)
    const enrichedWithApiStats = enrichedComponents.map((c) => {
      const api = apiData.components[c.name];
      return api ? { ...c, stats: api.stats } : c;
    });

    return { enrichedComponents: enrichedWithApiStats, apiData };
  }

  /**
   * Derive the doc-route base from the API output directory. The API/LLM
   * generators write per-component files under
   * `<…/routes>/<target>/[<group>/]<slug>`, so the public URL base is exactly
   * the output path's tail after the `routes/` segment — e.g.
   * `../../apps/docs/src/routes/blocks` → `/blocks` (from which primitives
   * resolve to `/blocks/primitives/<slug>` and components to
   * `/blocks/components/<slug>`), `.../routes/docs` → `/docs`, etc.
   *
   * Falls back to `/components` when the output path is not under a `routes/`
   * segment (e.g. an aggregate single-file config), preserving prior behaviour.
   */
  private deriveRouteBasePath(): string {
    const outputPath = this.config.output.api?.outputPath ?? '';
    const normalized = outputPath.replace(/\\/g, '/').replace(/\/+$/, '');
    const match = normalized.match(/(?:^|\/)routes\/(.+)$/);
    return match ? `/${match[1]}` : '/components';
  }

  /**
   * Phase 4: Generation - Generate API file, then LLM docs
   * CRITICAL: API must be generated FIRST, then consumed by LLM
   */
  private async generationPhase(
    enrichedComponents: EnrichedComponentInfo[],
    apiData: APIData
  ): Promise<GenerationResult> {
    console.log('📍 Phase 4: Generation');

    // Dedicated coordinator handles the entire generation logic
    const generationCoordinator = new GenerationCoordinator(this.config.output, this.errorHandler);

    // Validate configuration
    const configValidation = generationCoordinator.validateConfiguration();
    if (!configValidation.valid) {
      console.warn('⚠️  Generation configuration issues:', configValidation.errors);
    }

    // Display the generation plan (for debugging)
    const plan = generationCoordinator.getGenerationPlan();
    console.log(
      `  📋 Generation plan: ${plan.totalOutputs} outputs, ${plan.phases.filter((p) => p.enabled).length} active phases`
    );

    // Run all generations
    const result = await generationCoordinator.generateAll(enrichedComponents, apiData);

    return result;
  }

  /**
   * Create error result for failed pipeline execution
   */
  private createErrorResult(error: unknown): GenerationResult {
    const duration = Date.now() - this.startTime;

    return {
      success: false,
      outputs: [],
      errors: [
        {
          type: 'pipeline_error',
          message: error instanceof Error ? error.message : String(error)
        }
      ],
      stats: {
        totalComponents: 0,
        totalProps: 0,
        apiDataSize: 0
      },
      duration
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): GeneratorConfig {
    return this.config;
  }
}
