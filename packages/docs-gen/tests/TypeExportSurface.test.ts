import * as path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { ExtractionCoordinator } from '../src/core/extraction/ExtractionCoordinator';
import { ErrorHandler } from '../src/core/pipeline/ErrorHandler';
import { LocalTypesExtractor } from '../src/extractors/typescript/LocalTypesExtractor';
import {
  assertResolvablePublicExports,
  getProgramBundle
} from '../src/extractors/typescript/ProgramCache';
import type { ComponentManifest, ProcessingConfig, TypeDefinition } from '../src/types';

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
  } as unknown as ProcessingConfig;
}

// The `exported` flag is the property Stage 2's lint and Stage 3's page
// wiring will gate on, so it needs a control on both answers *and* on the
// "unknown" third state — a flag that silently reads `false` everywhere
// would make a lint pass for the wrong reason.

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const EXPORTS_PKG = path.join(FIXTURES, 'entry-exports-pkg');
const EXPORTS_CONFIG = path.join(EXPORTS_PKG, 'tsconfig.json');
const WIDGET = path.join(EXPORTS_PKG, 'src', 'lib', 'Widget', 'index.ts');

const MISSING_CONFIG = path.join(FIXTURES, 'entry-missing-pkg', 'tsconfig.json');
const CROSS_FILE_CONFIG = path.join(FIXTURES, 'cross-file-pkg', 'tsconfig.json');
const CROSS_FILE_FOO = path.join(FIXTURES, 'cross-file-pkg', 'src', 'Foo', 'index.ts');

async function typesOf(configPath: string | undefined, filePath: string, componentName: string) {
  const extractor = new LocalTypesExtractor(configPath ? { configPath } : undefined);
  const result = await extractor.extract({
    filePath,
    componentName,
    packageName: '@fixture/entry-exports-pkg'
  });
  expect(result.success).toBe(true);
  const byName: Record<string, TypeDefinition> = {};
  for (const definition of result.data ?? []) byName[definition.name] = definition;
  return byName;
}

describe('ProgramCache — public export surface', () => {
  it('unions the names of every typed entry in package.json#exports', () => {
    const names = getProgramBundle(EXPORTS_CONFIG).publicExportNames;
    expect(names).not.toBeNull();
    // Root entry.
    expect(names?.has('WidgetProps')).toBe(true);
    expect(names?.has('WidgetIntent')).toBe(true);
    expect(names?.has('WidgetTour')).toBe(true);
    // Subpath entry: `@fixture/entry-exports-pkg/sub` is a real import
    // specifier, so its names are public too. A root-only lookup reports
    // this one as private — which is what this assertion exists to catch.
    expect(names?.has('WidgetSubOnly')).toBe(true);
    // Exported from its own file, from no package entry.
    expect(names?.has('WidgetSecretSlots')).toBe(false);
    expect(names?.has('WidgetTourInternals')).toBe(false);
  });

  it('reports an unknown surface (null) for a package root without a manifest', () => {
    expect(getProgramBundle(CROSS_FILE_CONFIG).publicExportNames).toBeNull();
  });

  it('carries the failure on the bundle instead of throwing, and still caches', () => {
    // Throwing from the builder left `bundles` empty, so every extractor of
    // every component rebuilt the program: measured 160ms → 3667ms for the
    // same five components. A cache that only fills on the happy path is not
    // a cache.
    const first = getProgramBundle(MISSING_CONFIG);
    expect(first.publicExportNames).toBeNull();
    expect(first.publicExportFailure).toMatch(
      /declares typed entry points, but none of them resolves/
    );
    expect(getProgramBundle(MISSING_CONFIG).program).toBe(first.program);
  });

  it('raises that failure from the eager pipeline hook', () => {
    // Degrading to an empty set would label every type "not exported" — one
    // uniformly wrong answer that a downstream lint would then enforce.
    expect(() => assertResolvablePublicExports(MISSING_CONFIG)).toThrow(
      /declares typed entry points, but none of them resolves/
    );
    // A package that declares no typed entry at all is the documented
    // unknown case: one warning, not a failed run.
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => assertResolvablePublicExports(CROSS_FILE_CONFIG)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/no typed entry point found/));
    warn.mockRestore();
  });
});

describe('ExtractionCoordinator — the export-surface guard where it takes effect', () => {
  // The guard has to fire at phase start. Everything below it is constructed
  // inside a per-extractor try/catch that turns a throw into
  // `{ success: false, data: [] }` plus a console.warn and never propagates
  // it — measured on the pre-fix code, a package with unresolvable entries
  // extracted "5/5 components successfully" with 0 props, 0 variants and
  // 0 types, and exit code 0.
  it('aborts construction rather than extracting an empty component', () => {
    expect(
      () =>
        new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
          configPath: MISSING_CONFIG
        })
    ).toThrow(/declares typed entry points, but none of them resolves/);
  });

  it('applies the same contract on the update path', () => {
    const coordinator = new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
      configPath: EXPORTS_CONFIG
    });
    expect(() =>
      coordinator.updateConfig(processingConfig(), { configPath: MISSING_CONFIG })
    ).toThrow(/declares typed entry points, but none of them resolves/);
  });

  it('does not stand in the way of a package whose entries resolve', async () => {
    const coordinator = new ExtractionCoordinator(processingConfig(), new ErrorHandler(), {
      configPath: EXPORTS_CONFIG
    });
    const rich = await coordinator.extractAllComponents([
      {
        component: {
          name: 'Widget',
          packageName: '@fixture/entry-exports-pkg',
          filePath: WIDGET,
          description: '',
          props: [],
          variants: [],
          inheritance: [],
          stats: { totalProps: 0, directProps: 0, variantProps: 0, inheritedProps: 0 }
        },
        files: { main: WIDGET },
        packageInfo: { name: '@fixture/entry-exports-pkg', version: '0.0.0', path: EXPORTS_PKG }
      } as unknown as ComponentManifest
    ]);

    // The point of the guard is that a real run is *not* eviscerated.
    expect(rich[0]?.props.length).toBeGreaterThan(0);
    expect((rich[0] as unknown as { localTypes?: unknown[] }).localTypes?.length).toBeGreaterThan(
      0
    );
  });
});

describe('LocalTypesExtractor — exported flag', () => {
  it('marks locally declared types by their reachability from a package entry', async () => {
    const byName = await typesOf(EXPORTS_CONFIG, WIDGET, 'Widget');

    expect(byName.WidgetProps?.exported).toBe(true);
    expect(byName.WidgetIntent?.exported).toBe(true);
    expect(byName.WidgetSubOnly?.exported).toBe(true);
    expect(byName.WidgetSecretSlots?.exported).toBe(false);
  });

  it('marks transitively imported types too — reachability, not proximity', async () => {
    const byName = await typesOf(EXPORTS_CONFIG, WIDGET, 'Widget');

    // Pulled in through `import type { WidgetTour }`, declared in
    // internal/helpers.ts, re-exported from the root entry.
    expect(byName.WidgetTour?.scope).toBe('imported');
    expect(byName.WidgetTour?.exported).toBe(true);
    // Reached only by following WidgetTour's members — never re-exported.
    expect(byName.WidgetTourInternals?.scope).toBe('imported');
    expect(byName.WidgetTourInternals?.exported).toBe(false);
  });

  it('omits the flag entirely when the surface is unknown', async () => {
    // Program-backed but manifest-less: `false` would be a lie, so the key
    // must be absent rather than present-and-wrong.
    const programBacked = await typesOf(CROSS_FILE_CONFIG, CROSS_FILE_FOO, 'Foo');
    expect(programBacked.FooProps).toBeDefined();
    expect('exported' in (programBacked.FooProps as object)).toBe(false);

    // Single-file mode has no program to ask at all.
    const singleFile = await typesOf(undefined, WIDGET, 'Widget');
    expect(singleFile.WidgetProps).toBeDefined();
    expect('exported' in (singleFile.WidgetProps as object)).toBe(false);
  });
});
