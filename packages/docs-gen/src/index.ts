export { DocsGeneratorCLI } from './cli/CLI';
export { PipelineOrchestrator } from './core/pipeline/PipelineOrchestrator';
export { ConfigurationFactory, DocsConfigurationBuilder } from './schema/ConfigurationBuilder';

export type {
  APIData,
  ComponentAPIData,
  ComponentManifest,
  EnrichedComponentInfo,
  ExtractionResult,
  GenerationResult,
  GeneratorConfig,
  InputConfig,
  OutputConfig,
  PackageConfig,
  ProcessingConfig,
  ValidationResult
} from './types';
