import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';
import { VariantsExtractor } from '../src/extractors/variants/VariantsExtractor';

/**
 * One axis, two pages: the field documents `tier` from its tv() config, a
 * wrapper documents the `tier` it redeclares as `FieldProps['tier']`. Both
 * must list the values in the same order — the config's.
 */

const PKG = path.join(import.meta.dirname, 'fixtures', 'omit-shapes-pkg');
const VARIANTS = path.join(PKG, 'src', 'shared', 'field.variants.ts');
const SHAPES = path.join(PKG, 'src', 'Shapes', 'index.ts');

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

describe('variant values keep the tv() config order', () => {
  it('on the base page and on a wrapper that redeclares the axis', async () => {
    const variants = await new VariantsExtractor().extract({
      componentPath: VARIANTS,
      componentName: 'Field',
      variantsFilePath: VARIANTS
    });
    const extractor = new PropsExtractor({ configPath: path.join(PKG, 'tsconfig.json') });
    const props = await extractor.extract({ filePath: SHAPES, componentName: 'WrapField' });
    const axis = (name: string) => variants.data?.find((v) => v.name === name)?.values;
    const prop = (name: string) => props.data?.find((p) => p.name === name)?.values;

    expect(axis('tier')).toEqual(['modify', 'commit']);
    expect(axis('size')).toEqual(['xs', 'sm', 'md', 'lg']);
    expect(prop('tier')).toEqual(axis('tier'));
    expect(prop('size')).toEqual(axis('size'));
  });
});
