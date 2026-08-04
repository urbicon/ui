import * as path from 'node:path';
import type {
  ComponentInfo,
  InheritanceInfo,
  PropInfo,
  VariantInfo
} from '@urbicon-ui/shared-types';
import { ExtractorFactory } from '../../extractors/ExtractorFactory';
import {
  assertResolvablePublicExports,
  assertUsableTsConfig
} from '../../extractors/typescript/ProgramCache';
import type { PropsExtractor } from '../../extractors/typescript/PropsExtractor';
import type { VariantsExtractor } from '../../extractors/variants/VariantsExtractor';
import type {
  ComponentManifest,
  ExtractionResult,
  ProcessingConfig,
  TypeDefinition,
  TypeScriptConfig,
  TypeScriptExtractionConfig
} from '../../types';
import { type ErrorHandler, withErrorHandling } from '..';

/**
 * Coordinates all extraction operations for components
 * Reduces complexity in PipelineOrchestrator and enables better parallelization
 */
export class ExtractionCoordinator {
  private extractorFactory: ExtractorFactory;
  private config: ProcessingConfig;

  constructor(
    config: ProcessingConfig,
    private errorHandler: ErrorHandler,
    inputTypeScript?: TypeScriptConfig
  ) {
    this.config = config;
    this.extractorFactory = ExtractorFactory.getInstance(
      ExtractionCoordinator.resolveTsExtractionConfig(config, inputTypeScript)
    );
  }

  /**
   * Merge + validate the TypeScript extraction config — the single path for
   * both the constructor and `updateConfig`, so a later update cannot
   * diverge from construction.
   *
   * The tsconfig path is authored on `input.typescript` (TypeScriptConfig);
   * merge it into the extraction config the extractors actually receive.
   * Historically this field was never handed through, so the extractors
   * always ran on an empty ts.Program (single-file mode).
   *
   * Fail loud *before* extraction starts: a configured-but-broken tsconfig
   * must abort the run, not degrade into per-component warnings with
   * cross-file types silently missing from the artifacts.
   *
   * The same reasoning covers the package's public export surface, and for
   * the same mechanical reason: everything below this point is constructed
   * inside the per-extractor `try/catch` further down this file, which
   * converts any throw into `{ success: false, data: [] }` and drops the
   * error. A package whose typed `exports` targets no longer map onto
   * `src/lib/…` therefore produced a green run over 0 props / 0 variants /
   * 0 types. Both assertions must happen here, at the one level where an
   * error still escapes.
   */
  private static resolveTsExtractionConfig(
    config: ProcessingConfig,
    inputTypeScript?: TypeScriptConfig
  ): TypeScriptExtractionConfig | undefined {
    const tsExtractionConfig = ExtractionCoordinator.mergeTsConfig(
      config.extraction?.typescript,
      inputTypeScript
    );
    if (tsExtractionConfig?.configPath) {
      assertUsableTsConfig(tsExtractionConfig.configPath);
      assertResolvablePublicExports(tsExtractionConfig.configPath);
    }
    return tsExtractionConfig;
  }

  private static mergeTsConfig(
    extraction: TypeScriptExtractionConfig | undefined,
    input: TypeScriptConfig | undefined
  ): TypeScriptExtractionConfig | undefined {
    if (!extraction) return undefined;
    const configPath = input?.configPath ?? extraction.configPath;
    if (!configPath) return extraction;
    return { ...extraction, configPath: path.resolve(configPath) };
  }

  /**
   * Extract all components in parallel with proper error handling
   */
  async extractAllComponents(manifests: ComponentManifest[]): Promise<ComponentInfo[]> {
    console.log(`🔍 Extracting data for ${manifests.length} components...`);

    const richComponents: ComponentInfo[] = [];

    // Parallel extraction with error isolation
    if (this.config.parallel?.enabled) {
      const results = await this.extractInParallel(manifests);
      richComponents.push(...results.filter((c): c is ComponentInfo => Boolean(c)));
    } else {
      // Sequential extraction
      for (const manifest of manifests) {
        const result = await this.extractComponent(manifest);
        if (result) {
          richComponents.push(result);
        }
      }
    }

    console.log(
      `✅ Successfully extracted ${richComponents.length}/${manifests.length} components`
    );
    return richComponents;
  }

  /**
   * Extract single component with all extractors
   */
  async extractComponent(manifest: ComponentManifest): Promise<ComponentInfo | null> {
    const componentName = manifest.component.name;

    return withErrorHandling(
      async () => {
        console.log(`  🔍 Extracting: ${componentName}`);

        // Run all extractions in parallel (documentation loader removed).
        // Slot names come from the tv() `slots:` keys — a distinct pass from
        // the variant list, carried alongside it onto the rich component.
        const [variantsResult, inheritanceResult, examplesResult, slotNames] = await Promise.all([
          this.extractVariants(manifest),
          this.extractInheritance(manifest),
          this.extractExamples(manifest),
          this.extractSlotNames(manifest)
        ]);

        // Extract props with knowledge of variant keys (for Omit filtering)
        const variantKeys = ((variantsResult.data || []) as VariantInfo[]).map((v) => v.name);
        const propsResult = await this.extractProps(manifest, variantKeys);

        // Extract JSDoc metadata from *Props interface
        const [description, summary, tags, relatedComponents, stability] = await Promise.all([
          this.extractDescription(manifest),
          this.extractSummary(manifest),
          this.extractTags(manifest),
          this.extractRelated(manifest),
          this.extractStability(manifest)
        ]);

        if (!description) {
          console.warn(
            `⚠️  Missing @description on ${componentName}Props — add a @description JSDoc tag to ${manifest.component.filePath}`
          );
        }

        // Local types (type/interface definitions) from index.ts
        const localTypes = await this.extractLocalTypes(manifest);

        // Build rich component info
        const richComponent = {
          ...manifest.component,
          ...(description ? { description } : {}),
          ...(summary ? { summary } : {}),
          ...(tags.length > 0 ? { tags } : {}),
          ...(relatedComponents.length > 0 ? { relatedComponents } : {}),
          ...(stability ? { stability } : {}),
          props: (propsResult.data || []) as PropInfo[],
          variants: (variantsResult.data || []) as VariantInfo[],
          inheritance: (inheritanceResult.data || []) as InheritanceInfo[],
          localTypes: (localTypes.data || []) as TypeDefinition[],
          interfaceExamples: (examplesResult.data || []) as string[],
          slots: slotNames
        } as ComponentInfo & {
          localTypes?: TypeDefinition[];
          interfaceExamples?: string[];
          slots?: string[];
        };

        // Log extraction summary
        const counts = {
          props: richComponent.props.length,
          variants: richComponent.variants.length,
          inheritance: richComponent.inheritance.length,
          docSections: 0
        };

        console.log(
          `    ✅ ${componentName}: ${counts.props} props, ${counts.variants} variants, ${counts.inheritance} inheritance, ${counts.docSections} doc sections`
        );

        return richComponent;
      },
      this.errorHandler,
      {
        phase: 'extraction',
        packageName: componentName,
        operation: 'extract_component'
      }
    );
  }

  // ==========================================
  // INDIVIDUAL EXTRACTOR METHODS
  // ==========================================

  /**
   * Generate extraction statistics for reporting
   */
  generateExtractionStats(richComponents: ComponentInfo[]): {
    totalComponents: number;
    totalProps: number;
    totalVariants: number;
    averagePropsPerComponent: number;
    componentsWithVariants: number;
    componentsWithDocumentation: number;
    extractionErrors: number;
  } {
    const totalProps = richComponents.reduce((sum, comp) => sum + comp.props.length, 0);
    const totalVariants = richComponents.reduce((sum, comp) => sum + comp.variants.length, 0);
    const componentsWithVariants = richComponents.filter((comp) => comp.variants.length > 0).length;
    const componentsWithDocumentation = richComponents.filter((comp) => comp.documentation).length;

    return {
      totalComponents: richComponents.length,
      totalProps,
      totalVariants,
      averagePropsPerComponent: Math.round(totalProps / richComponents.length || 0),
      componentsWithVariants,
      componentsWithDocumentation,
      extractionErrors: 0 // Could be tracked via errorHandler
    };
  }

  /**
   * Clear all extractor caches
   */
  clearCache(): void {
    this.extractorFactory.clearCache();
  }

  /**
   * Update configuration (reusing one coordinator across runs).
   *
   * Threads `input.typescript.configPath` exactly like the constructor —
   * merged into the extraction config and eagerly validated *before* the
   * extractors are rebuilt. Pre-fix this path forwarded only the raw
   * `ProcessingConfig`, so an update silently dropped the tsconfig and every
   * subsequent run fell back to single-file extraction (cross-file types
   * missing from the artifacts, no error). Callers that carry a
   * `GeneratorConfig` must pass its `input.typescript` here, mirroring the
   * construction call in PipelineOrchestrator.extractionPhase().
   */
  updateConfig(newConfig: ProcessingConfig, inputTypeScript?: TypeScriptConfig): void {
    this.config = newConfig;
    this.extractorFactory.updateTsConfig(
      ExtractionCoordinator.resolveTsExtractionConfig(newConfig, inputTypeScript)
    );
  }

  private async extractProps(
    manifest: ComponentManifest,
    variantKeys?: string[]
  ): Promise<ExtractionResult<PropInfo[]>> {
    try {
      const propsExtractor = await this.extractorFactory.createPropsExtractor();

      return (await propsExtractor.extract({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name,
        variantKeys
      })) as ExtractionResult<PropInfo[]>;
    } catch (error) {
      console.warn(`⚠️  Props extraction failed for ${manifest.component.name}:`, error);
      return {
        success: false,
        data: [],
        errors: [
          {
            type: 'props_extraction_failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        warnings: [],
        metadata: {
          duration: 0,
          extractorVersion: '2.0.0',
          sourceFile: manifest.component.filePath,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  // ==========================================
  // PARALLEL EXTRACTION
  // ==========================================

  private async extractVariants(
    manifest: ComponentManifest
  ): Promise<ExtractionResult<VariantInfo[]>> {
    try {
      const variantsExtractor = await this.extractorFactory.createVariantsExtractor();

      return (await variantsExtractor.extract({
        componentPath: manifest.component.filePath,
        componentName: manifest.component.name,
        variantsFilePath: manifest.files?.variants
      })) as ExtractionResult<VariantInfo[]>;
    } catch (error) {
      console.warn(`⚠️  Variants extraction failed for ${manifest.component.name}:`, error);
      return {
        success: false,
        data: [],
        errors: [
          {
            type: 'variants_extraction_failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        warnings: [],
        metadata: {
          duration: 0,
          extractorVersion: '2.0.0',
          sourceFile: manifest.component.filePath,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  /**
   * Extract the tv() `slots:` keys (the real `slotClasses` slot names).
   * Reuses the cached VariantsExtractor instance; failure is non-fatal —
   * a component simply reports no slots rather than aborting extraction.
   */
  private async extractSlotNames(manifest: ComponentManifest): Promise<string[]> {
    try {
      const variantsExtractor =
        (await this.extractorFactory.createVariantsExtractor()) as unknown as VariantsExtractor;

      return await variantsExtractor.extractSlotNames({
        componentPath: manifest.component.filePath,
        componentName: manifest.component.name,
        // Omit the key entirely when absent (exactOptionalPropertyTypes) so the
        // extractor falls back to its own variants-file discovery.
        ...(manifest.files?.variants ? { variantsFilePath: manifest.files.variants } : {})
      });
    } catch (error) {
      console.warn(`⚠️  Slot extraction failed for ${manifest.component.name}:`, error);
      return [];
    }
  }

  private async extractInheritance(
    manifest: ComponentManifest
  ): Promise<ExtractionResult<InheritanceInfo[]>> {
    try {
      const inheritanceExtractor = await this.extractorFactory.createInheritanceExtractor();

      return (await inheritanceExtractor.extract({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      })) as ExtractionResult<InheritanceInfo[]>;
    } catch (error) {
      console.warn(`⚠️  Inheritance extraction failed for ${manifest.component.name}:`, error);
      return {
        success: false,
        data: [],
        errors: [
          {
            type: 'inheritance_extraction_failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        warnings: [],
        metadata: {
          duration: 0,
          extractorVersion: '2.0.0',
          sourceFile: manifest.component.filePath,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  private async extractLocalTypes(
    manifest: ComponentManifest
  ): Promise<ExtractionResult<TypeDefinition[]>> {
    try {
      const localTypesExtractor = await this.extractorFactory.createLocalTypesExtractor();
      return (await localTypesExtractor.extract({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name,
        packageName: manifest.component.packageName
      })) as ExtractionResult<TypeDefinition[]>;
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [
          {
            type: 'local_types_extraction_failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        warnings: [],
        metadata: {
          duration: 0,
          extractorVersion: '2.0.0',
          sourceFile: manifest.component.filePath,
          timestamp: new Date().toISOString()
        }
      } as unknown as ExtractionResult<TypeDefinition[]>;
    }
  }

  private async extractSummary(manifest: ComponentManifest): Promise<string | null> {
    try {
      const extractor = (await this.extractorFactory.createPropsExtractor()) as PropsExtractor;
      return await extractor.extractSummary({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      });
    } catch {
      return null;
    }
  }

  private async extractDescription(manifest: ComponentManifest): Promise<string | null> {
    try {
      const extractor = (await this.extractorFactory.createPropsExtractor()) as PropsExtractor;
      return await extractor.extractDescription({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      });
    } catch {
      return null;
    }
  }

  private async extractTags(manifest: ComponentManifest): Promise<string[]> {
    try {
      const extractor = (await this.extractorFactory.createPropsExtractor()) as PropsExtractor;
      return await extractor.extractTags({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      });
    } catch {
      return [];
    }
  }

  private async extractRelated(manifest: ComponentManifest): Promise<string[]> {
    try {
      const extractor = (await this.extractorFactory.createPropsExtractor()) as PropsExtractor;
      return await extractor.extractRelated({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      });
    } catch {
      return [];
    }
  }

  private async extractStability(
    manifest: ComponentManifest
  ): Promise<'experimental' | 'beta' | 'stable' | 'deprecated' | null> {
    try {
      const extractor = (await this.extractorFactory.createPropsExtractor()) as PropsExtractor;
      return await extractor.extractStability({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      });
    } catch {
      return null;
    }
  }

  private async extractExamples(manifest: ComponentManifest): Promise<ExtractionResult<string[]>> {
    try {
      const examplesExtractor = await this.extractorFactory.createExamplesExtractor();
      return (await examplesExtractor.extract({
        filePath: manifest.component.filePath,
        componentName: manifest.component.name
      })) as ExtractionResult<string[]>;
    } catch (error) {
      return {
        success: false,
        data: [],
        errors: [
          {
            type: 'examples_extraction_failed',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        ],
        warnings: [],
        metadata: {
          duration: 0,
          extractorVersion: '2.0.0',
          sourceFile: manifest.component.filePath,
          timestamp: new Date().toISOString()
        }
      } as unknown as ExtractionResult<string[]>;
    }
  }

  // ==========================================
  // EXTRACTION STATISTICS
  // ==========================================

  // Documentation extraction removed in hybrid architecture

  private async extractInParallel(
    manifests: ComponentManifest[]
  ): Promise<(ComponentInfo | null)[]> {
    const maxConcurrency = this.config.parallel?.maxConcurrency || 4;
    const batches = this.createBatches(manifests, maxConcurrency);

    console.log(
      `  🔄 Processing ${manifests.length} components in ${batches.length} batches (concurrency: ${maxConcurrency})`
    );

    const results: (ComponentInfo | null)[] = [];

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i] || [];
      console.log(`  📦 Processing batch ${i + 1}/${batches.length} (${batch.length} components)`);

      const batchResults = await Promise.all(
        batch.map((manifest) => this.extractComponent(manifest))
      );

      results.push(...batchResults);
    }

    return results;
  }

  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }

    return batches;
  }
}
