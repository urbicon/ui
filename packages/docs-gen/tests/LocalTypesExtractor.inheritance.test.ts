import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalTypesExtractor } from '../src/extractors/typescript/LocalTypesExtractor';
import type { TypeDefinition } from '../src/types';

/**
 * An interface is documented by everything it offers, not by what it happens
 * to add on top of a base.
 *
 * Until 2026-08-13 the Types section sliced `decl.members` and stopped there,
 * so `Column` — whose three shapes all extend `BaseColumn` and
 * `DerivableMixin` — reached the docs site as `id` + `accessor`. Fifteen
 * properties a reader needs to configure a column (`width`, `align`,
 * `dataType`, `priority`, `minWidth`, …) were unreachable from any generated
 * surface, and the pages restated them in code comments instead. Two
 * independent blind readers named the missing list as their top blocker.
 */

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const CROSS_FILE_PKG = path.join(FIXTURES, 'cross-file-pkg');
const CROSS_FILE_CONFIG = path.join(CROSS_FILE_PKG, 'tsconfig.json');
const FOO = path.join(CROSS_FILE_PKG, 'src', 'Foo', 'index.ts');

async function typesOf(): Promise<Record<string, TypeDefinition>> {
  const extractor = new LocalTypesExtractor({ configPath: CROSS_FILE_CONFIG });
  const result = await extractor.extract({
    filePath: FOO,
    componentName: 'Foo',
    packageName: '@fixture/cross-file-pkg'
  });
  expect(result.success).toBe(true);
  const byName: Record<string, TypeDefinition> = {};
  for (const definition of result.data ?? []) byName[definition.name] = definition;
  return byName;
}

describe('LocalTypesExtractor — heritage', () => {
  it('carries the members an interface inherits, with their JSDoc and their origin', async () => {
    const types = await typesOf();
    const plain = types.PlainProps;

    expect(plain, 'PlainProps should be collected').toBeTruthy();
    // Its own member survives…
    expect(plain.definition).toContain('own?: string');
    // …and the base's arrives with the doc comment that explains it.
    expect(plain.definition).toContain('duration?: number');
    expect(plain.definition).toContain('Duration of the entrance animation');
    // Named, so a reader can tell inherited members from declared ones.
    expect(plain.definition).toContain('inherited from BazProps');
    // The count reports what the definition actually holds.
    expect(plain.members).toBe(2);
  });

  it('leaves an `Omit<Base, …>` heritage clause alone', async () => {
    // The exclusion list makes this a different question — which member of the
    // base survives — and the props pipeline answers it separately
    // (`resolveOmitBaseInterface`). Pinned so the boundary is a decision on
    // record rather than something that quietly changes with the next edit.
    const types = await typesOf();
    const foo = types.FooProps;

    expect(foo, 'FooProps should be collected').toBeTruthy();
    expect(foo.definition).toContain('tour?: WidgetTour');
    expect(foo.definition).not.toContain('inherited from');
    expect(foo.definition).not.toContain('label?: string');
  });
});
