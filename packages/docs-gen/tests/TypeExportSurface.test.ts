import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalTypesExtractor } from '../src/extractors/typescript/LocalTypesExtractor';
import { getProgramBundle } from '../src/extractors/typescript/ProgramCache';
import type { TypeDefinition } from '../src/types';

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

  it('fails loud when the manifest declares typed entries none of which resolve', () => {
    // Degrading to an empty set here would label every type "not exported" —
    // one uniformly wrong answer that a downstream lint would then enforce.
    expect(() => getProgramBundle(MISSING_CONFIG)).toThrow(
      /declares typed entry points, but none of them resolves/
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
