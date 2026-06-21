import { describe, expect, it } from 'vitest';
import { parseHistory, serializeHistoryEntry } from './history.js';
import type { ValidationHistoryEntry } from './types.js';

const entry = (over: Partial<ValidationHistoryEntry> = {}): ValidationHistoryEntry => ({
  date: '2026-06-21T10:00:00.000Z',
  files: 3,
  errors: 0,
  warnings: 1,
  infos: 2,
  correctness: 95,
  slop: 60,
  ...over
});

describe('history serialize ⇆ parse', () => {
  it('round-trips one entry through an ndjson line', () => {
    const e = entry();
    const parsed = parseHistory(serializeHistoryEntry(e));
    expect(parsed).toEqual([e]);
  });

  it('serialises to a single line (no embedded newline)', () => {
    expect(serializeHistoryEntry(entry())).not.toContain('\n');
  });

  it('parses multiple lines newest-last, preserving order', () => {
    const a = entry({ date: '2026-06-19T00:00:00.000Z', slop: 40 });
    const b = entry({ date: '2026-06-20T00:00:00.000Z', slop: 50 });
    const blob = `${serializeHistoryEntry(a)}\n${serializeHistoryEntry(b)}\n`;
    expect(parseHistory(blob).map((e) => e.slop)).toEqual([40, 50]);
  });
});

describe('history parse tolerance', () => {
  it('skips blank lines and a malformed/truncated tail without throwing', () => {
    const good = serializeHistoryEntry(entry());
    const blob = `\n${good}\n{"date":"2026-06-21T11:00:00Z","corre`; // half-written CI tail
    const parsed = parseHistory(blob);
    expect(parsed).toHaveLength(1);
    expect(parsed[0]!.correctness).toBe(95);
  });

  it('rejects JSON that lacks the entry shape', () => {
    expect(parseHistory('{"foo":1}\n[1,2,3]\n"a string"\nnull')).toEqual([]);
  });

  it('returns [] for an empty blob', () => {
    expect(parseHistory('')).toEqual([]);
    expect(parseHistory('   \n\n')).toEqual([]);
  });
});
