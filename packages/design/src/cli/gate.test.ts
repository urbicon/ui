import type { LintReport } from '@urbicon-ui/design-engine/linter';
import { describe, expect, it } from 'vitest';
import { evaluateGate, parseSlopFloor } from './gate.js';

/** Minimal LintReport fixture — only the fields the gate reads. */
function report(p: {
  error?: number;
  warning?: number;
  info?: number;
  slop?: number;
  filename?: string;
}): LintReport {
  return {
    findings: [],
    scores: { correctness: 100, slop: p.slop ?? 100 },
    counts: { error: p.error ?? 0, warning: p.warning ?? 0, info: p.info ?? 0 },
    filename: p.filename
  };
}

describe('parseSlopFloor', () => {
  it('returns null when absent (slop stays advisory)', () => {
    expect(parseSlopFloor(undefined)).toBe(null);
  });

  it('parses a valid 0–100 integer', () => {
    expect(parseSlopFloor('40')).toBe(40);
    expect(parseSlopFloor('0')).toBe(0);
    expect(parseSlopFloor('100')).toBe(100);
  });

  it('rejects a bare flag with no number', () => {
    expect(parseSlopFloor(true)).toBe('invalid');
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(parseSlopFloor('40.5')).toBe('invalid');
    expect(parseSlopFloor('-1')).toBe('invalid');
    expect(parseSlopFloor('101')).toBe('invalid');
    expect(parseSlopFloor('abc')).toBe('invalid');
    expect(parseSlopFloor('')).toBe('invalid');
  });
});

describe('evaluateGate', () => {
  it('passes a clean run', () => {
    const r = evaluateGate([report({})], { strict: false, slopFloor: null });
    expect(r.failed).toBe(false);
    expect(r.correctnessFailed).toBe(false);
    expect(r.slopBreaches).toEqual([]);
  });

  it('fails on errors (correctness gate, always on)', () => {
    const r = evaluateGate([report({ error: 1 })], { strict: false, slopFloor: null });
    expect(r.failed).toBe(true);
    expect(r.correctnessFailed).toBe(true);
  });

  it('passes warnings by default, fails them under --strict', () => {
    const reports = [report({ warning: 2 })];
    expect(evaluateGate(reports, { strict: false, slopFloor: null }).failed).toBe(false);
    expect(evaluateGate(reports, { strict: true, slopFloor: null }).failed).toBe(true);
  });

  it('never gates slop without a floor, even at slop 0', () => {
    const r = evaluateGate([report({ slop: 0 })], { strict: false, slopFloor: null });
    expect(r.failed).toBe(false);
    expect(r.slopBreaches).toEqual([]);
  });

  it('fails a file below the slop floor, keeping correctness untouched', () => {
    const r = evaluateGate([report({ slop: 20, filename: 'Generic.svelte' })], {
      strict: false,
      slopFloor: 40
    });
    expect(r.failed).toBe(true);
    expect(r.correctnessFailed).toBe(false); // slop alone fails it
    expect(r.slopBreaches).toEqual([{ label: 'Generic.svelte', slop: 20 }]);
  });

  it('gates per file — one generic page cannot hide behind clean ones', () => {
    const reports = [
      report({ slop: 100, filename: 'A.svelte' }),
      report({ slop: 10, filename: 'B.svelte' }),
      report({ slop: 100, filename: 'C.svelte' })
    ];
    const r = evaluateGate(reports, { strict: false, slopFloor: 50 });
    expect(r.failed).toBe(true);
    expect(r.slopBreaches).toEqual([{ label: 'B.svelte', slop: 10 }]);
  });

  it('treats a score exactly at the floor as passing (floor is a minimum)', () => {
    const r = evaluateGate([report({ slop: 40 })], { strict: false, slopFloor: 40 });
    expect(r.failed).toBe(false);
    expect(r.slopBreaches).toEqual([]);
  });

  it('sums counts across files', () => {
    const r = evaluateGate([report({ error: 1, warning: 1 }), report({ error: 2, info: 3 })], {
      strict: false,
      slopFloor: null
    });
    expect(r.totals).toEqual({ error: 3, warning: 1, info: 3 });
  });
});
