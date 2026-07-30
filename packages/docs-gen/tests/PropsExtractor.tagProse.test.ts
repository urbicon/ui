import * as path from 'node:path';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { PropsExtractor } from '../src/extractors/typescript/PropsExtractor';

const FIXTURES = path.join(import.meta.dirname, 'fixtures');
const FILE = path.join(FIXTURES, 'tag-trailing-prose.ts');

/**
 * TypeScript attaches every line after a JSDoc tag to that tag's comment, so a
 * paragraph written below the tag block ends up *inside* the last tag's value.
 * That shipped `"Toast\n\nBadge props are a discriminated union…"` as a related
 * component name into the catalogue, `llm.txt` and the docs site — a chip that
 * can never resolve.
 */
describe('repeated JSDoc tags stop at the end of their line', () => {
  let extractor: PropsExtractor;

  beforeAll(() => {
    extractor = new PropsExtractor();
  });

  it('keeps only the name when prose follows the tag block', async () => {
    const related = await extractor.extractRelated({
      filePath: FILE,
      componentName: 'TrailingProse'
    });
    expect(related).toEqual(['Alert', 'Toast']);
  });

  it('does the same for @tag when @tag closes the block', async () => {
    const tags = await extractor.extractTags({
      filePath: FILE,
      componentName: 'TrailingProseTagLast'
    });
    expect(tags).toEqual(['feedback']);
  });

  it('says so instead of dropping the prose silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await extractor.extractRelated({ filePath: FILE, componentName: 'TrailingProse' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('@related "Toast"'));
    warn.mockRestore();
  });

  it('stays quiet when the prose sits above the tags', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const related = await extractor.extractRelated({
      filePath: FILE,
      componentName: 'CleanTags'
    });
    expect(related).toEqual(['Alert', 'Toast']);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
