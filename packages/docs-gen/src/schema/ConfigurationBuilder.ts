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
 * Create the complete baseline `GeneratorConfig` every builder starts from:
 * all extractors on, schema-validation reporting (not failing), LLM + API
 * output enabled with generic paths. Setters on the builder are overrides of
 * this baseline, so a preset only has to state what differs.
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
 * Fluent builder for `GeneratorConfig`. Starts from `createDefaultConfig()`
 * so every setter is a partial override; `build()` validates first and
 * throws on a config that cannot run (no packages, enabled output without a
 * path). The `ConfigurationFactory` presets are thin compositions over this.
 */
export class DocsConfigurationBuilder implements GeneratorConfigBuilder {
  private config: GeneratorConfig;

  /**
   * Start a builder from the defaults, optionally shallow-merging a partial
   * base config over them (top-level sections replace wholesale; the result
   * is deep-cloned so the builder never aliases caller state).
   */
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

  /**
   * Add a package to scan (repeatable). At least one package is required —
   * `validate()` fails an empty list, so `build()` throws without any.
   */
  addPackage(packageConfig: PackageConfig): GeneratorConfigBuilder {
    this.config.input.packages.push(packageConfig);
    return this;
  }

  /**
   * Set the package TypeScript context. `configPath` is the switch that
   * enables program-backed cross-file type resolution in extraction; every
   * `ConfigurationFactory` preset points it at the package's tsconfig.json.
   */
  setTypeScript(tsConfig: TypeScriptConfig): GeneratorConfigBuilder {
    this.config.input.typescript = tsConfig;
    return this;
  }

  /**
   * Override the docs-schema expectations (version, strictness), merged over
   * the default `{ version: '2.0.0', strict: true }`.
   */
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

  /**
   * Override extraction settings, shallow-merged over the defaults (a passed
   * sub-config like `typescript` replaces that whole block, so restate any
   * default flags you want to keep).
   */
  setExtraction(
    extractionConfig: Partial<GeneratorConfig['processing']['extraction']>
  ): GeneratorConfigBuilder {
    this.config.processing.extraction = {
      ...this.config.processing.extraction,
      ...extractionConfig
    };
    return this;
  }

  /** Override enrichment settings (cross-references, derived metadata), shallow-merged over the defaults. */
  setEnrichment(
    enrichmentConfig: Partial<GeneratorConfig['processing']['enrichment']>
  ): GeneratorConfigBuilder {
    this.config.processing.enrichment = {
      ...this.config.processing.enrichment,
      ...enrichmentConfig
    };
    return this;
  }

  /** Override validation settings (rules, schema gate), shallow-merged over the defaults. */
  setValidation(
    validationConfig: Partial<GeneratorConfig['processing']['validation']>
  ): GeneratorConfigBuilder {
    this.config.processing.validation = {
      ...this.config.processing.validation,
      ...validationConfig
    };
    return this;
  }

  /**
   * Turn on batched parallel extraction (defaults: concurrency 4, strategy
   * `auto`). Note the side effect in `PipelineOrchestrator`: with parallel
   * extraction enabled the ErrorHandler is created non-fail-fast.
   */
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

  /**
   * Configure the LLM output target, merged over the defaults. An
   * extension-less `outputPath` selects directory mode (per-component
   * llm.txt tree + llms.txt manifests) — how all presets run.
   */
  setLLMOutput(llmConfig: Partial<GeneratorConfig['output']['llm']>): GeneratorConfigBuilder {
    this.config.output.llm = {
      ...this.config.output.llm,
      ...llmConfig
    };
    return this;
  }

  /**
   * Configure the API output target, merged over the defaults. An
   * extension-less `outputPath` selects directory mode (one typed `api.ts`
   * per component under its route) — how all presets run.
   */
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

  /**
   * Turn on watch settings (defaults: 1000 ms debounce, add/change/unlink).
   * Reserved — the CLI ships no watch loop yet; see `WatchConfig`.
   */
  enableWatch(watchConfig?: Partial<GeneratorConfig['watch']>): GeneratorConfigBuilder {
    this.config.watch = {
      enabled: true,
      debounce: 1000,
      events: ['add', 'change', 'unlink'],
      ...watchConfig
    };
    return this;
  }

  /**
   * Turn on debug reporting (default level `info`, console output). Gates
   * the full error report on partially-failed pipeline runs.
   */
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

  /**
   * Check the assembled config without building. Blocking errors: no
   * packages, or an enabled output (LLM/API) without an `outputPath`.
   * Warnings are advisory and never fail validation.
   */
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

  /**
   * Validate and return the final config. Throws with all validation errors
   * joined when the config cannot run; logs (but tolerates) warnings.
   */
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

  /** Discard everything configured so far and return to the pristine defaults. */
  reset(): GeneratorConfigBuilder {
    this.config = createDefaultConfig();
    return this;
  }
}

// ==========================================
// CONFIGURATION FACTORY - Preset configurations
// ==========================================

/**
 * Preset `GeneratorConfig`s for the four in-repo targets (blocks, docs,
 * table, auth) plus file-based loading for external configs. Each preset
 * points the extraction at the package's own tsconfig (cross-file type
 * resolution) and writes into the docs app's static/routes trees — these are
 * exactly the configs `docs-gen generate` runs per `--target`.
 */
// biome-ignore lint/complexity/noStaticOnlyClass: intentional namespace grouping of config factories.
export class ConfigurationFactory {
  /**
   * Preset for `@urbicon-ui/blocks`: scans every primitives/components
   * `index.ts`, resolves types via `../blocks/tsconfig.json`, and writes
   * llm.txt to `apps/docs/static/blocks` + per-component api.ts under the
   * `/blocks` routes.
   */
  static blocks(): GeneratorConfig {
    return (
      new DocsConfigurationBuilder()
        .addPackage({
          name: '@urbicon-ui/blocks',
          path: '../blocks',
          glob: {
            components: 'src/lib/{primitives,components}/**/index.ts',
            variants: 'src/lib/{primitives,components}/**/*.variants.ts',
            documentation: 'src/lib/{primitives,components}/**/docs.svelte'
          }
        })
        // Package tsconfig → shared ts.Program → cross-file type resolution
        // (imported Props bases, Omit<ImportedProps, …>, type-only imports).
        .setTypeScript({ configPath: '../blocks/tsconfig.json' })

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
        .build()
    );
  }

  /**
   * Preset for `@urbicon-ui/docs` (the documentation UI components):
   * mirrors the blocks preset onto `static/docs` + the `/docs` routes.
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
      .setTypeScript({ configPath: '../docs/tsconfig.json' })

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
   * Preset for `@urbicon-ui/table`: a single component entry
   * (`src/lib/core/table/index.ts`), written onto `static/table` + the
   * `/table` routes.
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
      .setTypeScript({ configPath: '../table/tsconfig.json' })

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
   * Preset for `@urbicon-ui/auth`: scans each `index.ts` under
   * `src/lib/client/components/`, written onto `static/auth` + the `/auth`
   * routes.
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
      .setTypeScript({ configPath: '../auth/tsconfig.json' })

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
   * Minimal config for an arbitrary package following the conventional
   * `src/components/<Name>/` layout, with default output paths. No tsconfig
   * is wired, so extraction stays single-file.
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
   * Load a config from disk — `.json` or an ES module (`.js`/`.mjs`/`.ts`
   * with a default or named `config` export). The loaded data is replayed
   * through the builder, so it gets the same defaults-merge and fail-loud
   * validation as a programmatic config. Throws on a missing file, an
   * unsupported extension, or validation errors.
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

  /** Parse a JSON config file and replay it through the builder. */
  private static async loadJSONConfig(filePath: string): Promise<GeneratorConfig> {
    const content = await fs.readFile(filePath, 'utf-8');
    const configData = JSON.parse(content);

    return ConfigurationFactory.validateAndBuildConfig(configData, filePath);
  }

  /**
   * Import an ES-module config (default or named `config` export) and replay
   * it through the builder. Throws when the module exports neither.
   */
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

  /**
   * Replay loaded config data section-by-section through a fresh builder,
   * so file-based configs share the exact defaults + validation of
   * programmatic ones (build() throws on an unrunnable config).
   */
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
