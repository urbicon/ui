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
    }
    return ExtractorFactory.instance;
  }

  /**
   * Create or get cached PropsExtractor (TypeScript-based)
   */
  async createPropsExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'props';

    if (!this.extractorCache.has(cacheKey)) {
      const { PropsExtractor } = await import('./typescript/PropsExtractor');
      const extractor = new PropsExtractor(this.tsConfig as unknown as Record<string, unknown>);
      this.extractorCache.set(cacheKey, extractor as BaseExtractor<unknown, unknown>);
    }

    return this.extractorCache.get(cacheKey)!;
  }

  /**
   * Create or get cached InheritanceExtractor (TypeScript-based)
   */
  async createInheritanceExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'inheritance';

    if (!this.extractorCache.has(cacheKey)) {
      const { InheritanceExtractor } = await import('./typescript/InheritanceExtractor');
      const extractor = new InheritanceExtractor(
        this.tsConfig as unknown as Record<string, unknown>
      ) as unknown as BaseExtractor<unknown, unknown>;
      this.extractorCache.set(cacheKey, extractor);
    }

    return this.extractorCache.get(cacheKey)!;
  }

  /**
   * Create or get cached VariantsExtractor (TypeScript-based)
   */
  async createVariantsExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'variants';

    if (!this.extractorCache.has(cacheKey)) {
      const { VariantsExtractor } = await import('./variants/VariantsExtractor');
      const extractor = new VariantsExtractor(
        this.tsConfig as unknown as Record<string, unknown>
      ) as unknown as BaseExtractor<unknown, unknown>;
      this.extractorCache.set(cacheKey, extractor);
    }

    return this.extractorCache.get(cacheKey)!;
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
    if (!this.extractorCache.has(key)) {
      const mod = await import('./typescript/ExamplesExtractor');
      const extractor = new mod.ExamplesExtractor(
        this.tsConfig as unknown as Record<string, unknown>
      ) as unknown as BaseExtractor<unknown, unknown>;
      this.extractorCache.set(key, extractor);
    }
    return this.extractorCache.get(key)!;
  }

  async createLocalTypesExtractor(): Promise<BaseExtractor<unknown, unknown>> {
    const cacheKey = 'localTypes';
    if (!this.extractorCache.has(cacheKey)) {
      const { LocalTypesExtractor } = await import('./typescript/LocalTypesExtractor');
      const extractor = new LocalTypesExtractor(
        this.tsConfig as unknown as Record<string, unknown>
      ) as unknown as BaseExtractor<unknown, unknown>;
      this.extractorCache.set(cacheKey, extractor);
    }
    return this.extractorCache.get(cacheKey)!;
  }
}
