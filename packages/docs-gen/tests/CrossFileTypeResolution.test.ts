import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { InheritanceExtractor } from '../src/extractors/typescript/InheritanceExtractor';
import { LocalTypesExtractor } from '../src/extractors/typescript/LocalTypesExtractor';
import { getProgramBundle, parseTsConfig } from '../src/extractors/typescript/ProgramCache';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

const PKG = path.join(import.meta.dirname, 'fixtures', 'cross-file-pkg');
const CONFIG = path.join(PKG, 'tsconfig.json');
const FOO = path.join(PKG, 'src', 'Foo', 'index.ts');

describe('ProgramCache', () => {
  it('fails loud on a missing tsconfig (write strict, no silent fallback)', () => {
    expect(() => parseTsConfig(path.join(PKG, 'does-not-exist', 'tsconfig.json'))).toThrow(
      /tsconfig not found/
    );
  });

  it('shares one program per configPath across bundles', () => {
    const a = getProgramBundle(CONFIG);
    const b = getProgramBundle(CONFIG);
    expect(a.program).toBe(b.program);
    expect(a.packageRoot).toBe(PKG);
  });
});

describe('PropsExtractor — cross-file resolution (program-backed)', () => {
  it('resolves Omit<ImportedProps, keys> heritage from the package sources, minus omitted keys', async () => {
    const extractor = new PropsExtractor({ configPath: CONFIG });
    const result = await extractor.extract({ filePath: FOO, componentName: 'Foo' });
    expect(result.success).toBe(true);
    const byName = Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));

    // Inherited from BarProps (declared in another file) with real JSDoc.
    expect(byName.label).toBeDefined();
    expect(byName.label.description).toContain('Label text');
    expect(byName.label.source.type).toBe('inherited');
    expect(byName.error).toBeDefined();
    expect(byName.size?.values).toEqual(expect.arrayContaining(['sm', 'md', 'lg']));

    // The Omit key never surfaces.
    expect(byName.hidden).toBeUndefined();

    // Direct props still present.
    expect(byName.tour).toBeDefined();
    expect(byName.tour.source).toEqual({ type: 'direct', name: 'FooProps' });
  });

  it('resolves a plain imported heritage clause', async () => {
    const extractor = new PropsExtractor({ configPath: CONFIG });
    const result = await extractor.extract({ filePath: FOO, componentName: 'Plain' });
    const byName = Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));

    expect(byName.duration).toBeDefined();
    expect(byName.duration.description).toContain('entrance animation');
    expect(byName.duration.source).toEqual({ type: 'inherited', name: 'BazProps' });
  });

  it('stays single-file without configPath (placeholder instead of cross-file props)', async () => {
    const extractor = new PropsExtractor();
    const result = await extractor.extract({ filePath: FOO, componentName: 'Plain' });
    const byName = Object.fromEntries((result.data ?? []).map((p) => [p.name, p]));

    expect(byName.duration).toBeUndefined();
    expect(byName['...BazProps']).toBeDefined();
  });
});

describe('InheritanceExtractor — cross-file resolution (program-backed)', () => {
  it('enumerates Omit<ImportedProps, literal keys> props minus the omitted keys', async () => {
    const extractor = new InheritanceExtractor({ configPath: CONFIG });
    const result = await extractor.extract({ filePath: FOO, componentName: 'Foo' });
    expect(result.success).toBe(true);
    const omit = (result.data ?? []).find((i) => i.typeName.startsWith('Omit<'));
    expect(omit).toBeDefined();
    expect(omit?.source).toBe('omit-pattern');
    const names = (omit?.props ?? []).map((p) => p.name);
    expect(names).toContain('label');
    expect(names).toContain('error');
    expect(names).not.toContain('hidden');
  });

  it('resolves a plain imported heritage clause as resolved-interface', async () => {
    const extractor = new InheritanceExtractor({ configPath: CONFIG });
    const result = await extractor.extract({ filePath: FOO, componentName: 'Plain' });
    const item = (result.data ?? []).find((i) => i.typeName === 'BazProps');
    expect(item).toBeDefined();
    expect(item?.source).toBe('resolved-interface');
    expect((item?.props ?? []).map((p) => p.name)).toContain('duration');
  });
});

describe('LocalTypesExtractor — imported types (program-backed)', () => {
  it('collects type-only imports with transitive references and class signatures', async () => {
    const extractor = new LocalTypesExtractor({ configPath: CONFIG });
    const result = await extractor.extract({
      filePath: FOO,
      componentName: 'Foo',
      packageName: '@fixture/pkg'
    });
    expect(result.success).toBe(true);
    const byName = Object.fromEntries((result.data ?? []).map((t) => [t.name, t]));

    // Locally declared types keep working (and stay unmarked → 'local').
    expect(byName.FooProps?.type).toBe('interface');
    expect(byName.FooProps?.scope).toBeUndefined();

    // Direct type-only imports.
    expect(byName.WidgetTour?.type).toBe('interface');
    expect(byName.WidgetTour?.scope).toBe('imported');
    expect(byName.WidgetTour?.definition).toContain('onStep');
    expect(byName.WidgetTour?.documentation).toContain('widget tour definition');

    // Transitive: WidgetTour → WidgetStep + WidgetStepEvent.
    expect(byName.WidgetStep).toBeDefined();
    expect(byName.WidgetStepEvent).toBeDefined();

    // Class → public-signature summary, privates stripped.
    expect(byName.WidgetController?.type).toBe('class');
    expect(byName.WidgetController?.definition).toContain('startTour(tour: WidgetTour): boolean');
    expect(byName.WidgetController?.definition).toContain('get stepIndex(): number');
    expect(byName.WidgetController?.definition).not.toContain('#secret');
    expect(byName.WidgetController?.definition).not.toContain('internalState');
    expect(byName.WidgetController?.definition).not.toContain('reset');

    // Size metadata for the llm.txt oversize summary: top-level member count
    // (public members for classes) + repo-relative source path.
    expect(byName.WidgetTour?.members).toBe(3); // id, steps, onStep
    expect(byName.WidgetController?.members).toBe(3); // constructor, startTour, get stepIndex
    expect(byName.WidgetTour?.sourcePath).toContain('src/shared/types.ts');
    expect(byName.FooProps?.sourcePath).toContain('src/Foo/index.ts');
  });

  it('skips the imported pass without a program (single-file mode)', async () => {
    const extractor = new LocalTypesExtractor();
    const result = await extractor.extract({
      filePath: FOO,
      componentName: 'Foo',
      packageName: '@fixture/pkg'
    });
    const names = (result.data ?? []).map((t) => t.name);
    expect(names).toContain('FooProps');
    expect(names).not.toContain('WidgetTour');
  });
});
