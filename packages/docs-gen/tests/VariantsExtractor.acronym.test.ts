import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { VariantsExtractor } from '../src/extractors/variants/VariantsExtractor';

/**
 * A component name that starts with an acronym (`QRCode`, `A2UIView`) names its
 * tv() export and file with the whole acronym lowercased: `qrCodeVariants` in
 * `qr-code.variants.ts`, `a2uiViewVariants` in `a2ui-view.variants.ts`. A lookup
 * that lowers only the first letter finds neither, and the component then has
 * no variant axes and no slots at all.
 */

const FIXTURES = path.join(import.meta.dirname, 'fixtures', 'acronym-variants');

let extractor: VariantsExtractor;

beforeAll(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  extractor = new VariantsExtractor();
});

/** The pipeline's input: ComponentFinder hands over the file it found. */
function located(dir: string, name: string, file: string) {
  return {
    componentPath: path.join(FIXTURES, dir, 'index.ts'),
    componentName: name,
    variantsFilePath: path.join(FIXTURES, dir, file)
  };
}

/** No file handed over: the extractor's own discovery in the component directory. */
function unlocated(dir: string, name: string) {
  return { componentPath: path.join(FIXTURES, dir, 'index.ts'), componentName: name };
}

describe('VariantsExtractor — acronym-led component names', () => {
  it('finds the declaration of a letter acronym (qrTagVariants for QRTag)', async () => {
    const result = await extractor.extract(located('QRTag', 'QRTag', 'qr-tag.variants.ts'));
    expect(result.success).toBe(true);
    expect(result.data?.map((v) => [v.name, v.values, v.defaultValue])).toEqual([
      ['frame', ['card', 'none'], 'none']
    ]);
    expect(
      await extractor.extractSlotNames(located('QRTag', 'QRTag', 'qr-tag.variants.ts'))
    ).toEqual(['root', 'code']);
  });

  it('finds the declaration of an acronym with a digit (x2yPanelVariants for X2YPanel)', async () => {
    expect(
      await extractor.extractSlotNames(located('X2YPanel', 'X2YPanel', 'x2y-panel.variants.ts'))
    ).toEqual(['root', 'surface']);
  });

  it('finds the kebab-cased file in the component directory on its own', async () => {
    expect((await extractor.extract(unlocated('QRTag', 'QRTag'))).data?.map((v) => v.name)).toEqual(
      ['frame']
    );
    expect(await extractor.extractSlotNames(unlocated('X2YPanel', 'X2YPanel'))).toEqual([
      'root',
      'surface'
    ]);
  });
});
