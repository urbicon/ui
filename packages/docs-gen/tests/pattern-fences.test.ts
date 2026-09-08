import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { collectPatternFences, documentLine, fenceSpan } from '../scripts/pattern-fences';

/**
 * The half of `examples-lint`'s pattern corpus that fails by reporting nothing:
 * an extractor that stops recognising a fence leaves the gate green, and a line
 * map that slips points the reader at prose. Both are cheap to pin here; the
 * end-to-end control that the corpus really reaches svelte-check lives in
 * `scripts/examples-lint.test.ts`, because it costs a full gate run.
 */
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/pattern-fences');

describe('collectPatternFences', () => {
  it('takes every svelte fence, in file order, numbered per document', () => {
    const { fences, unclosed } = collectPatternFences(join(FIXTURES, 'corpus'));

    expect(unclosed).toEqual([]);
    expect(fences.map((f) => [f.source.split('/').pop(), f.index, f.openLine, f.code])).toEqual([
      ['a-two-fences.md', 1, 5, '<p>first</p>'],
      // the info string's first word decides, so `svelte title="second"` counts
      ['a-two-fences.md', 2, 13, '<p>second</p>'],
      // dedented by the opener's own indentation, as CommonMark requires
      ['b-indented-tilde.md', 1, 5, '<p>indented</p>'],
      // a ``` line inside a ~~~ fence is content, not a close
      [
        'b-indented-tilde.md',
        2,
        9,
        '<p>tilde</p>\n```\n<p>a backtick line inside a tilde fence is content</p>'
      ]
    ]);
  });

  it('skips the fences of a non-Markdown file in the same directory', () => {
    const { fences } = collectPatternFences(join(FIXTURES, 'corpus'));
    expect(fences.some((f) => f.source.endsWith('.txt'))).toBe(false);
  });

  it('reports a fence that never closes, at its opening line', () => {
    const { fences, unclosed } = collectPatternFences(join(FIXTURES, 'unclosed'));

    expect(fences).toEqual([]);
    expect(unclosed).toHaveLength(1);
    expect(unclosed[0]?.source.split('/').pop()).toBe('never-closed.md');
    expect(unclosed[0]?.line).toBe(3);
  });
});

describe('documentLine', () => {
  it("maps svelte-check's 0-based file line onto the document", () => {
    // the fence opens on document line 5, so its first code line is 6
    expect(documentLine(5, 0)).toBe(6);
    expect(documentLine(5, 4)).toBe(10);
  });
});

describe('fenceSpan', () => {
  it('spans the code lines, not the delimiters', () => {
    const { fences } = collectPatternFences(join(FIXTURES, 'corpus'));
    const [first] = fences;
    if (!first) throw new Error('fixture lost its first fence');
    expect(fenceSpan(first)).toEqual({ from: 6, to: 6 });

    const tilde = fences.find((f) => f.code.includes('tilde'));
    if (!tilde) throw new Error('fixture lost its tilde fence');
    expect(fenceSpan(tilde)).toEqual({ from: 10, to: 12 });
  });
});
