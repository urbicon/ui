import type { TypeScriptExtractionConfig } from '../types';
import type { BaseExtractor } from './BaseExtractor';

/**
 * Universal factory that manages both TypeScript and non-TypeScript extractors
 */
export class ExtractorFactory {
  private static instance: ExtractorFactory;
  private extractorCache = new Map<string, BaseExtractor>();
  private tsConfig: TypeScriptExtractionConfig | undefined;

  private constructor(tsConfig?: TypeScriptExtractionConfig) {
    this.tsConfig = tsConfig;
  }

  static getInstance(tsConfig?: TypeScriptExtractionConfig): ExtractorFactory {
    if (!ExtractorFactory.instance) {
      ExtractorFactory.instance = new ExtractorFactory(tsConfig);
    } else if (
      tsConfig !== undefined &&
      JSON.stringify(tsConfig) !== JSON.stringify(ExtractorFactory.instance.tsConfig)
    ) {
      // `--target all` runs several packages through one process; each brings
      // its own configPath. Rebuilding the (cheap) extractor instances here
      // keeps them keyed to the right package — the expensive ts.Programs are
      // cached per configPath in ProgramCache and survive this.
      ExtractorFactory.instance.updateTsConfig(tsConfig);
    }
    return ExtractorFactory.instance;
  }

  /**
   * Create or get cached PropsExtractor (TypeScript-based)
   */
  async createPropsExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'props';

    const cached = this.extractorCache.get(cacheKey);
    if (cached) return cached;

    const { PropsExtractor } = await import('./typescript/PropsExtractor');
    const extractor = new PropsExtractor(
      this.tsConfig as unknown as Record<string, unknown>
    ) as BaseExtractor<unknown, unknown>;
    this.extractorCache.set(cacheKey, extractor);
    return extractor;
  }

  /**
   * Create or get cached InheritanceExtractor (TypeScript-based)
   */
  async createInheritanceExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'inheritance';

    const cached = this.extractorCache.get(cacheKey);
    if (cached) return cached;

    const { InheritanceExtractor } = await import('./typescript/InheritanceExtractor');
    const extractor = new InheritanceExtractor(
      this.tsConfig as unknown as Record<string, unknown>
    ) as unknown as BaseExtractor<unknown, unknown>;
    this.extractorCache.set(cacheKey, extractor);
    return extractor;
  }

  /**
   * Create or get cached VariantsExtractor (TypeScript-based)
   */
  async createVariantsExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'variants';

    const cached = this.extractorCache.get(cacheKey);
    if (cached) return cached;

    const { VariantsExtractor } = await import('./variants/VariantsExtractor');
    const extractor = new VariantsExtractor(
      this.tsConfig as unknown as Record<string, unknown>
    ) as unknown as BaseExtractor<unknown, unknown>;
    this.extractorCache.set(cacheKey, extractor);
    return extractor;
  }

  /**
   * Clear all cached extractors
   */
  clearCache(): void {
    this.extractorCache.forEach((extractor) => {
      extractor.clearCache();
    });
    this.extractorCache.clear();
  }

  /**
   * Update TypeScript configuration for TypeScript-based extractors
   */
  updateTsConfig(newTsConfig?: TypeScriptExtractionConfig): void {
    this.tsConfig = newTsConfig;
    this.clearCache(); // Force recreation with new config
  }

  async createExamplesExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const key = 'examples';
    const cached = this.extractorCache.get(key);
    if (cached) return cached;

    const mod = await import('./typescript/ExamplesExtractor');
    const extractor = new mod.ExamplesExtractor(
      this.tsConfig as unknown as Record<string, unknown>
    ) as unknown as BaseExtractor<unknown, unknown>;
    this.extractorCache.set(key, extractor);
    return extractor;
  }

  async createLocalTypesExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'localTypes';
    const cached = this.extractorCache.get(cacheKey);
    if (cached) return cached;

    const { LocalTypesExtractor } = await import('./typescript/LocalTypesExtractor');
    const extractor = new LocalTypesExtractor(
      this.tsConfig as unknown as Record<string, unknown>
    ) as unknown as BaseExtractor<unknown, unknown>;
    this.extractorCache.set(cacheKey, extractor);
    return extractor;
  }
}
