import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ExtractionCoordinator } from '../src/core/extraction/ExtractionCoordinator';
import { ErrorHandler } from '../src/core/pipeline/ErrorHandler';
import type { ComponentManifest, ProcessingConfig } from '../src/types';

/**
 * A component whose props cannot be extracted is a pipeline error — the run's
 * error barrier fails `docs:gen` on it — never a component published with an
 * empty API table.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const CHAINY = path.join(PKG, 'src', 'Chainy', 'index.ts');

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

function manifest(name: string): ComponentManifest {
  return {
    component: { name, filePath: CHAINY, packageName: '@fixture/pkg' },
    files: { main: CHAINY },
    packageInfo: { name: '@fixture/pkg', version: '0.0.0' }
  } as unknown as ComponentManifest;
}

async function extract(name: string) {
  const errors = new ErrorHandler({ failFast: false, logLevel: 'error' });
  const coordinator = new ExtractionCoordinator(processingConfig(), errors, { configPath: CONFIG });
  const component = await coordinator.extractComponent(manifest(name));
  return { component, summary: errors.getSummary(), report: errors.generateReport() };
}

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('ExtractionCoordinator — a failed props extraction', () => {
  it('reports an error and drops the component', async () => {
    const { component, summary, report } = await extract('BareChain');
    expect(component).toBeNull();
    expect(summary.totalErrors).toBe(1);
    expect(report).toContain('Props extraction failed for BareChain');
    expect(report).toContain("'tone'");
  });

  it('leaves a component whose props extract alone', async () => {
    const { component, summary } = await extract('Chainy');
    expect(summary.totalErrors).toBe(0);
    expect(component?.props.map((p) => p.name)).toContain('tone');
  });
});
