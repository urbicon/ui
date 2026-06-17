import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import type {
  ConfigValidationResult,
  GeneratorConfig,
  GeneratorConfigBuilder,
  PackageConfig,
  TypeScriptConfig
} from '../types';

// ==========================================
// DEFAULT CONFIGURATION FACTORY
// ==========================================

/**
 * Creates a complete default configuration
 */
function createDefaultConfig(): GeneratorConfig {
  return {
    input: {
      packages: [],
      schema: {
        version: '2.0.0',
        strict: true
      }
    },
    processing: {
      extraction: {
        typescript: {
          extractJSDoc: true,
          extractTypeReferences: true,
          extractDefaultValues: true,
          resolveTypeAliases: true
        },
        variants: {
          frameworks: ['tailwind-variants'],
          extractDefaults: true
        },
        documentation: {
          validateSchema: true,
          allowPartialDocs: false
        },
        inheritance: {
          resolveExternalTypes: true,
          includeHTMLAttributes: true,
          maxDepth: 5
        }
      },
      enrichment: {
        crossReferences: {
          enabled: true,
          includeExternal: true
        },
        metadata: {
          extractStats: true,
          calculateComplexity: true
        }
      },
      validation: {
        rules: [],
        schema: {
          enabled: true,
          failOnError: false
        },
        examples: {
          syntax: true
        },
        components: {}
      }
    },
    output: {
      llm: {
        enabled: true,
        // Write into a directory by default to enable per-component files
        outputPath: './generated/llm',
        format: 'markdown'
      },
      api: {
        enabled: true,
        outputPath: './src/lib/generated/api-props.ts',
        format: 'typescript'
      },
      shared: {
        clean: true,
        createDirectories: true,
        overwrite: true,
        backup: {
          enabled: false
        }
      }
    }
  };
}

/**
 * Builder for creating and validating documentation configurations
 */
export class DocsConfigurationBuilder implements GeneratorConfigBuilder {
  private config: GeneratorConfig;

  constructor(baseConfig?: Partial<GeneratorConfig>) {
    this.config = createDefaultConfig();

    // If a baseConfig is provided, merge it with the defaults
    if (baseConfig) {
      this.config = JSON.parse(JSON.stringify({ ...this.config, ...baseConfig }));
    }
  }

  // ==========================================
  // INPUT CONFIGURATION
  // ==========================================

  addPackage(packageConfig: PackageConfig): GeneratorConfigBuilder {
    this.config.input.packages.push(packageConfig);
    return this;
  }

  setTypeScript(tsConfig: TypeScriptConfig): GeneratorConfigBuilder {
    this.config.input.typescript = tsConfig;
    return this;
  }

  setSchema(schemaConfig: Partial<GeneratorConfig['input']['schema']>): GeneratorConfigBuilder {
    this.config.input.schema = {
      ...this.config.input.schema,
      ...schemaConfig
    };
    return this;
  }

  // ==========================================
  // PROCESSING CONFIGURATION
  // ==========================================

  setExtraction(
    extractionConfig: Partial<GeneratorConfig['processing']['extraction']>
  ): GeneratorConfigBuilder {
    this.config.processing.extraction = {
      ...this.config.processing.extraction,
      ...extractionConfig
    };
    return this;
  }

  setEnrichment(
    enrichmentConfig: Partial<GeneratorConfig['processing']['enrichment']>
  ): GeneratorConfigBuilder {
    this.config.processing.enrichment = {
      ...this.config.processing.enrichment,
      ...enrichmentConfig
    };
    return this;
  }

  setValidation(
    validationConfig: Partial<GeneratorConfig['processing']['validation']>
  ): GeneratorConfigBuilder {
    this.config.processing.validation = {
      ...this.config.processing.validation,
      ...validationConfig
    };
    return this;
  }

  enableParallel(
    parallelConfig?: Partial<GeneratorConfig['processing']['parallel']>
  ): GeneratorConfigBuilder {
    this.config.processing.parallel = {
      enabled: true,
      maxConcurrency: 4,
      strategy: 'auto',
      ...parallelConfig
    };
    return this;
  }

  // ==========================================
  // OUTPUT CONFIGURATION
  // ==========================================

  setLLMOutput(llmConfig: Partial<GeneratorConfig['output']['llm']>): GeneratorConfigBuilder {
    this.config.output.llm = {
      ...this.config.output.llm,
      ...llmConfig
    };
    return this;
  }

  setAPIOutput(apiConfig: Partial<GeneratorConfig['output']['api']>): GeneratorConfigBuilder {
    this.config.output.api = {
      ...this.config.output.api,
      ...apiConfig
    };
    return this;
  }

  // ==========================================
  // ADDITIONAL FEATURES
  // ==========================================

  enableWatch(watchConfig?: Partial<GeneratorConfig['watch']>): GeneratorConfigBuilder {
    this.config.watch = {
      enabled: true,
      debounce: 1000,
      events: ['add', 'change', 'unlink'],
      ...watchConfig
    };
    return this;
  }

  enableDebug(debugConfig?: Partial<GeneratorConfig['debug']>): GeneratorConfigBuilder {
    this.config.debug = {
      enabled: true,
      level: 'info',
      output: {
        console: true
      },
      ...debugConfig
    };
    return this;
  }

  // ==========================================
  // BUILD & VALIDATE
  // ==========================================

  validate(): ConfigValidationResult {
    const errors: Array<{ path: string; message: string }> = [];
    const warnings: Array<{ path: string; message: string }> = [];

    // Basic validation
    if (!this.config.input.packages.length) {
      errors.push({
        path: 'input.packages',
        message: 'At least one package must be configured'
      });
    }

    if (!this.config.output.llm.outputPath && this.config.output.llm.enabled) {
      errors.push({
        path: 'output.llm.outputPath',
        message: 'LLM output path is required when LLM output is enabled'
      });
    }

    if (!this.config.output.api.outputPath && this.config.output.api.enabled) {
      errors.push({
        path: 'output.api.outputPath',
        message: 'API output path is required when API output is enabled'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  build(): GeneratorConfig {
    const validation = this.validate();

    if (!validation.valid) {
      throw new Error(
        `Configuration validation failed: ${validation.errors.map((e) => e.message).join(', ')}`
      );
    }

    if (validation.warnings && validation.warnings.length > 0) {
      console.warn(
        'Configuration warnings:',
        validation.warnings.map((w) => w.message)
      );
    }

    // No type cast needed anymore
    return this.config;
  }

  /**
   * Reset to default configuration
   */
  reset(): GeneratorConfigBuilder {
    this.config = createDefaultConfig();
    return this;
  }
}

// ==========================================
// CONFIGURATION FACTORY - Preset configurations
// ==========================================

// biome-ignore lint/complexity/noStaticOnlyClass: intentional namespace grouping of config factories.
export class ConfigurationFactory {
  /**
   * Create Blocks-specific configuration
   */
  static blocks(): GeneratorConfig {
    return new DocsConfigurationBuilder()
      .addPackage({
        name: '@urbicon-ui/blocks',
        path: '../blocks',
        glob: {
          components: 'src/lib/{primitives,components}/**/index.ts',
          variants: 'src/lib/{primitives,components}/**/*.variants.ts',
          documentation: 'src/lib/{primitives,components}/**/docs.svelte'
        }
      })

      .setLLMOutput({
        enabled: true,
        // New static layout under blocks with grouping
        outputPath: '../../apps/docs/static/blocks',
        format: 'text'
      })
      .setAPIOutput({
        enabled: true,
        // Directory mode; will write per-component api.ts under group folder (components/primitives)
        outputPath: '../../apps/docs/src/routes/blocks',
        format: 'typescript'
      })
      .build();
  }

  /**
   * Create Docs-specific configuration
   */
  static docs(): GeneratorConfig {
    return new DocsConfigurationBuilder()
      .addPackage({
        name: '@urbicon-ui/docs',
        path: '../docs',
        glob: {
          components: 'src/lib/components/**/index.ts',
          variants: 'src/lib/components/**/*.variants.ts',
          documentation: 'src/lib/components/**/docs.svelte'
        }
      })

      .setLLMOutput({
        enabled: true,
        // Write under SvelteKit static path, mirroring routes hierarchy
        outputPath: '../../apps/docs/static/docs',
        format: 'text'
      })
      .setAPIOutput({
        enabled: true,
        outputPath: '../../apps/docs/src/routes/docs',
        format: 'typescript'
      })
      .build();
  }

  /**
   * Create Table-specific configuration
   */
  static table(): GeneratorConfig {
    return new DocsConfigurationBuilder()
      .addPackage({
        name: '@urbicon-ui/table',
        path: '../table',
        glob: {
          components: 'src/lib/core/table/index.ts',
          documentation: 'src/lib/core/table/docs.svelte'
        }
      })

      .setLLMOutput({
        enabled: true,
        // Write under SvelteKit static path, mirroring routes hierarchy
        outputPath: '../../apps/docs/static/table',
        format: 'text'
      })
      .setAPIOutput({
        enabled: true,
        outputPath: '../../apps/docs/src/routes/table',
        format: 'typescript'
      })
      .build();
  }

  /**
   * Create Auth-specific configuration
   */
  static auth(): GeneratorConfig {
    return new DocsConfigurationBuilder()
      .addPackage({
        name: '@urbicon-ui/auth',
        path: '../auth',
        glob: {
          components: 'src/lib/client/components/*/index.ts'
        }
      })

      .setLLMOutput({
        enabled: true,
        outputPath: '../../apps/docs/static/auth',
        format: 'text'
      })
      .setAPIOutput({
        enabled: true,
        outputPath: '../../apps/docs/src/routes/auth',
        format: 'typescript'
      })
      .build();
  }

  /**
   * Create single package configuration
   */
  static singlePackage(packagePath: string, packageName: string): GeneratorConfig {
    return new DocsConfigurationBuilder()
      .addPackage({
        name: packageName,
        path: packagePath,
        glob: {
          components: 'src/components/*/index.ts',
          variants: 'src/components/*/*.variants.ts',
          documentation: 'src/components/*/docs.ts'
        }
      })
      .build();
  }

  /**
   * Load configuration from file
   */
  static async fromFile(configPath: string): Promise<GeneratorConfig> {
    try {
      const absolutePath = path.resolve(configPath);

      // Check if file exists
      await fs.access(absolutePath);

      console.log(`📋 Loading configuration from: ${absolutePath}`);

      // Determine file type and load accordingly
      const ext = path.extname(absolutePath).toLowerCase();

      switch (ext) {
        case '.json':
          return ConfigurationFactory.loadJSONConfig(absolutePath);

        case '.js':
        case '.mjs':
        case '.ts':
          return ConfigurationFactory.loadESModuleConfig(absolutePath);

        default:
          throw new Error(`Unsupported config file type: ${ext}. Supported: .json, .js, .mjs, .ts`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.includes('ENOENT')) {
        throw new Error(`Configuration file not found: ${configPath}`, { cause: error });
      }
      throw new Error(
        `Failed to load configuration from ${configPath}: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error }
      );
    }
  }

  private static async loadJSONConfig(filePath: string): Promise<GeneratorConfig> {
    const content = await fs.readFile(filePath, 'utf-8');
    const configData = JSON.parse(content);

    return ConfigurationFactory.validateAndBuildConfig(configData, filePath);
  }

  private static async loadESModuleConfig(filePath: string): Promise<GeneratorConfig> {
    // Use dynamic import to load ES modules
    const configModule = await import(fileURLToPath(filePath));
    const configData = configModule.default || configModule.config;

    if (!configData) {
      throw new Error(
        `Configuration file must export a default config or named 'config' export: ${filePath}`
      );
    }

    return ConfigurationFactory.validateAndBuildConfig(configData, filePath);
  }

  private static validateAndBuildConfig(
    configData: Partial<GeneratorConfig>,
    filePath: string
  ): GeneratorConfig {
    // Create builder and populate with loaded data
    const builder = new DocsConfigurationBuilder();

    // Apply loaded configuration data
    if (configData.input?.packages) {
      configData.input.packages.forEach((pkg: PackageConfig) => {
        builder.addPackage(pkg);
      });
    }

    if (configData.input?.typescript) {
      builder.setTypeScript(configData.input.typescript);
    }

    if (configData.processing?.extraction) {
      builder.setExtraction(configData.processing.extraction);
    }

    if (configData.processing?.enrichment) {
      builder.setEnrichment(configData.processing.enrichment);
    }

    if (configData.processing?.validation) {
      builder.setValidation(configData.processing.validation);
    }

    if (configData.output?.llm) {
      builder.setLLMOutput(configData.output.llm);
    }

    if (configData.output?.api) {
      builder.setAPIOutput(configData.output.api);
    }

    if (configData.watch) {
      builder.enableWatch(configData.watch);
    }

    if (configData.debug) {
      builder.enableDebug(configData.debug);
    }

    // Build and validate
    const config = builder.build();
    console.log(`✅ Configuration loaded successfully from ${filePath}`);

    return config;
  }
}
