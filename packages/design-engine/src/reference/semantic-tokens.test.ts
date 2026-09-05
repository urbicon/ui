import { describe, expect, it } from 'vitest';
import {
  escapeCell,
  renderFamilyTable,
  SEMANTIC_TOKENS,
  type SemanticTokens
} from './semantic-tokens.js';

/**
 * A role sentence lands verbatim inside a GFM table cell, so the escaper has
 * to keep two characters from being read as syntax: `|` (a cell boundary) and
 * `\` (which makes the NEXT `|` literal). Escaping the pipe alone turns a
 * literal `\|` in the input into `\\|` — a literal backslash followed by an
 * unescaped pipe — and the row splits one cell early.
 *
 * The reader below follows GFM: only `\|` and `\\` are escape pairs inside a
 * cell; any other backslash is text.
 */

const unescapeCell = (s: string): string => s.replace(/\\([\\|])/g, '$1');

/** Cells of a rendered row, split on unescaped pipes; the outer pipes are dropped. */
function cellsOf(row: string): string[] {
  const cells: string[] = [];
  let buf = '';
  for (let i = 0; i < row.length; i++) {
    const c = row[i];
    if (c === '\\' && (row[i + 1] === '|' || row[i + 1] === '\\')) {
      buf += c + row[i + 1];
      i++;
      continue;
    }
    if (c === '|') {
      cells.push(buf);
      buf = '';
      continue;
    }
    buf += c;
  }
  cells.push(buf);
  return cells.slice(1, -1).map((s) => s.trim());
}

const CASES = ['a | b', 'a \\ b', 'a \\| b', 'ends with \\', '\\\\|', 'x \\\\ y \\| z'];

describe('escapeCell', () => {
  for (const input of CASES) {
    it(`keeps ${JSON.stringify(input)} in one cell and round-trips it`, () => {
      const cells = cellsOf(`| ${escapeCell(input)} |`);
      expect(cells).toHaveLength(1);
      expect(unescapeCell(cells[0] as string)).toBe(input);
    });
  }
});

describe('renderFamilyTable', () => {
  it('keeps a role with backslashes and pipes inside its own cell', () => {
    const role = 'reads `a \\| b` — backslash and pipe both survive';
    const data: SemanticTokens = {
      ...SEMANTIC_TOKENS,
      families: {
        ...SEMANTIC_TOKENS.families,
        border: [{ name: 'border-x', role, light: { raw: 'x' }, dark: { raw: 'y' } }]
      }
    };
    const rows = renderFamilyTable('border', data).split('\n');
    const cells = cellsOf(rows[2] as string);
    expect(cells).toHaveLength(5);
    expect(unescapeCell(cells[2] as string)).toBe(role);
    expect(cells[3]).toBe('x');
  });
});
