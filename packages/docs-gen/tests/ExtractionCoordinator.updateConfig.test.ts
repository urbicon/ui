import * as path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ExtractionCoordinator } from '../src/core/extraction/ExtractionCoordinator';
import { ErrorHandler } from '../src/core/pipeline/ErrorHandler';
import type { ExtractorFactory } from '../src/extractors/ExtractorFactory';
import type { ProcessingConfig } from '../src/types';

// ---------------------------------------------------------------------------
// configPath threading through the reconfiguration path.
//
// The program-backed extraction threads `input.typescript.configPath` through
// the ExtractionCoordinator *constructor* (merge into the extraction config +
// eager assertUsableTsConfig). Pre-fix, `updateConfig` — the surface for
// reusing one coordinator across runs — forwarded only the raw
// ProcessingConfig: the tsconfig silently dropped out and every subsequent run
// fell back to single-file extraction. These tests pin the update path to the
// constructor's contract: same merge, same eager fail-loud validation.
// ---------------------------------------------------------------------------

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');

function processingConfig(): ProcessingConfig {
  return {
    extraction: {
      typescript: {
        extractJSDoc: true,
        extractTypeReferences: true,
        extractDefaultValues: true,
        resolveTypeAliases: true
      },
      variants: { frameworks: ['tailwind-variants'], extractDefaults: true },
      documentation: { validateSchema: true, allowPartialDocs: false },
      inheritance: { resolveExternalTypes: true, includeHTMLAttributes: true, maxDepth: 5 }
    },
    enrichment: {
      crossReferences: { enabled: true, includeExternal: true },
      metadata: { extractStats: true, calculateComplexity: true }
    },
    validation: {
      rules: [],
      schema: { enabled: true, failOnError: false },
      examples: {},
      components: {}
    }
  };
}

function factoryOf(coordinator: ExtractionCoordinator): ExtractorFactory {
  return (coordinator as unknown as { extractorFactory: ExtractorFactory }).extractorFactory;
}

describe('ExtractionCoordinator.updateConfig — configPath threading', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('threads input.typescript.configPath into the factory, resolved like the constructor', () => {
    const coordinator = new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
      configPath: CONFIG
    });
    const spy = vi.spyOn(factoryOf(coordinator), 'updateTsConfig');

    coordinator.updateConfig(processingConfig(), { configPath: CONFIG });

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ configPath: path.resolve(CONFIG) }));
  });

  it('keeps a configPath authored directly on extraction.typescript when no input config is passed', () => {
    const coordinator = new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
      configPath: CONFIG
    });
    const spy = vi.spyOn(factoryOf(coordinator), 'updateTsConfig');

    const next = processingConfig();
    next.extraction.typescript.configPath = CONFIG;
    coordinator.updateConfig(next);

    expect(spy).toHaveBeenCalledWith(expect.objectContaining({ configPath: path.resolve(CONFIG) }));
  });

  it('fails loud on a broken tsconfig BEFORE rebuilding the extractors (eager validation)', () => {
    const coordinator = new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
      configPath: CONFIG
    });
    const spy = vi.spyOn(factoryOf(coordinator), 'updateTsConfig');

    expect(() =>
      coordinator.updateConfig(processingConfig(), {
        configPath: path.join(PKG, 'does-not-exist', 'tsconfig.json')
      })
    ).toThrow(/tsconfig not found/);
    // Validation is eager: the factory must not have been touched — the
    // previous (working) extractor set stays live instead of a half-updated one.
    expect(spy).not.toHaveBeenCalled();
  });

  it('constructor and updateConfig apply the same fail-loud contract', () => {
    const broken = { configPath: path.join(PKG, 'nope', 'tsconfig.json') };
    expect(() => new ExtractionCoordinator(processingConfig(), new ErrorHandler(), broken)).toThrow(
      /tsconfig not found/
    );
  });
});
