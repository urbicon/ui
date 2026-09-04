import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VariantsExtractor } from '../src/extractors/variants/VariantsExtractor';
import type { VariantInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Per-value descriptions. A tv() value is a bare key (`dot: {}`), so the only
// place its meaning can live in source is a comment above it — and the only
// comment form read is a JSDoc block that touches the key. Surveyed before the
// form was chosen: of the repo's 1018 values, 30 carry a `//` line directly
// above the key and two thirds of those are maintainer notes ("tv() does not
// dedupe across variants…"), so `//` cannot be the description form.
// ---------------------------------------------------------------------------

const FIXTURES = path.join(import.meta.dirname, 'fixtures');

let extractor: VariantsExtractor;

beforeAll(() => {
  // The extractor logs progress; keep the suite output clean.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  extractor = new VariantsExtractor();
});

async function extractFixture(file: string, componentName: string): Promise<VariantInfo[]> {
  const fixture = path.join(FIXTURES, file);
  const result = await extractor.extract({
    componentPath: fixture,
    componentName,
    variantsFilePath: fixture
  });
  return result.data ?? [];
}

describe('VariantsExtractor — per-value descriptions', () => {
  let variant: VariantInfo | undefined;
  let size: VariantInfo | undefined;

  beforeAll(async () => {
    const variants = await extractFixture('value-docs.variants.ts', 'Toggle');
    variant = variants.find((v) => v.name === 'variant');
    size = variants.find((v) => v.name === 'size');
  });

  it('lifts the JSDoc block touching a value key, its lines merged into one', () => {
    expect(variant?.valueDescriptions?.dot).toBe(
      'Small indicator dot left of the label — outline only when off, filled in the intent colour when on.'
    );
  });

  it('skips a pragma line between the block and the key', () => {
    expect(variant?.valueDescriptions?.square).toBe('Compact square.');
  });

  it('does not attribute the block above the axis to the first value', () => {
    expect(variant?.valueDescriptions).not.toHaveProperty('default');
  });

  it('does not read a // note touching the key as a description', () => {
    expect(variant?.valueDescriptions).not.toHaveProperty('pill');
  });

  it('does not read a block separated from the key by a blank line', () => {
    expect(variant?.valueDescriptions).not.toHaveProperty('detached');
  });

  it('omits valueDescriptions entirely when no value carries a block', () => {
    expect(size).toBeDefined();
    expect(size).not.toHaveProperty('valueDescriptions');
  });

  it('leaves the value list itself as it was', () => {
    expect(variant?.values).toEqual(['default', 'detached', 'dot', 'pill', 'square']);
  });
});
