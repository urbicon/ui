import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VariantsExtractor } from '../src/extractors/variants/VariantsExtractor';
import type { VariantInfo } from '../src/types';

// ---------------------------------------------------------------------------
// Per-value descriptions. A tv() value is a bare key (`dot: {}`), so its
// meaning lives in the JSDoc block on that key — attached by TypeScript the
// way a prop's JSDoc is, and read through the same `extractJSDocComment`.
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

  it('lifts the JSDoc block on a value key, its lines merged into one', () => {
    expect(variant?.valueDescriptions?.dot).toBe(
      'Small indicator dot left of the label — outline only when off, filled in the intent colour when on.'
    );
  });

  it('is not disturbed by a pragma line between the block and the key', () => {
    expect(variant?.valueDescriptions?.square).toBe('Compact square.');
  });

  it('is not disturbed by a blank line between the block and the key', () => {
    expect(variant?.valueDescriptions?.detached).toBe(
      'Separated from the key by a blank line — attached all the same.'
    );
  });

  it('keeps the prose and drops an inline tag, as for a prop', () => {
    expect(variant?.valueDescriptions?.ring).toBe('Hollow ring.');
  });

  it('does not attribute the block on the axis key to the first value', () => {
    expect(variant?.valueDescriptions).not.toHaveProperty('default');
  });

  it('does not read a // note as a description', () => {
    expect(variant?.valueDescriptions).not.toHaveProperty('pill');
  });

  it('omits valueDescriptions entirely when no value carries a block', () => {
    expect(size).toBeDefined();
    expect(size).not.toHaveProperty('valueDescriptions');
  });

  it('leaves the value list itself as it was', () => {
    expect(variant?.values).toEqual(['default', 'detached', 'dot', 'pill', 'ring', 'square']);
  });
});
