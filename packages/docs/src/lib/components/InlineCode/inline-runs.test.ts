import { describe, expect, it } from 'vitest';
import { parseInlineRuns } from './inline-runs';

const plain = (text: string) => ({ text, code: false, strong: false, em: false });

describe('parseInlineRuns', () => {
  it('returns one plain run for text without markers', () => {
    expect(parseInlineRuns('Just prose.')).toEqual([plain('Just prose.')]);
  });

  it('returns no runs for an empty string', () => {
    expect(parseInlineRuns('')).toEqual([]);
  });

  it('turns paired backticks into code', () => {
    expect(parseInlineRuns('Set `value` here')).toEqual([
      plain('Set '),
      { text: 'value', code: true, strong: false, em: false },
      plain(' here')
    ]);
  });

  it('leaves every backtick as a character when one is unpaired', () => {
    expect(parseInlineRuns('a `b` c`')).toEqual([plain('a `b` c`')]);
  });

  it('renders **strong** and *em*', () => {
    expect(parseInlineRuns('in **minor units**, *not* major')).toEqual([
      plain('in '),
      { text: 'minor units', code: false, strong: true, em: false },
      plain(', '),
      { text: 'not', code: false, strong: false, em: true },
      plain(' major')
    ]);
  });

  it('nests code inside strong', () => {
    expect(parseInlineRuns('use **`CurrencyInput`** instead')).toEqual([
      plain('use '),
      { text: 'CurrencyInput', code: true, strong: true, em: false },
      plain(' instead')
    ]);
  });

  it('keeps asterisks inside a code span literal', () => {
    expect(parseInlineRuns('glob `*.variants.ts` and `**/x`')).toEqual([
      plain('glob '),
      { text: '*.variants.ts', code: true, strong: false, em: false },
      plain(' and '),
      { text: '**/x', code: true, strong: false, em: false }
    ]);
  });

  it('nests strong inside em', () => {
    expect(parseInlineRuns('*a **b** c*')).toEqual([
      { text: 'a ', code: false, strong: false, em: true },
      { text: 'b', code: false, strong: true, em: true },
      { text: ' c', code: false, strong: false, em: true }
    ]);
  });

  it('leaves unpaired or space-flanked asterisks as characters', () => {
    expect(parseInlineRuns('a * b and **open')).toEqual([plain('a * b and **open')]);
    expect(parseInlineRuns('2 * 3 * 4')).toEqual([plain('2 * 3 * 4')]);
  });

  it('leaves runs of three or more asterisks as characters', () => {
    expect(parseInlineRuns('*** heading')).toEqual([plain('*** heading')]);
  });

  it('leaves links and HTML as text', () => {
    expect(parseInlineRuns('[docs](x.md) <script>alert(1)</script>')).toEqual([
      plain('[docs](x.md) <script>alert(1)</script>')
    ]);
  });
});
