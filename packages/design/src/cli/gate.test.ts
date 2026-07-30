import type { LintReport } from '@urbicon-ui/design-engine/linter';
import { describe, expect, it } from 'vitest';
import { evaluateGate, parseCraftFloor } from './gate.js';

/** Minimal LintReport fixture — only the fields the gate reads. */
function report(p: {
  error?: number;
  warning?: number;
  info?: number;
  craft?: number;
  filename?: string;
}): LintReport {
  return {
    findings: [],
    scores: { correctness: 100, craft: p.craft ?? 100 },
    counts: { error: p.error ?? 0, warning: p.warning ?? 0, info: p.info ?? 0 },
    filename: p.filename
  };
}

describe('parseCraftFloor', () => {
  it('returns null when absent (craft stays advisory)', () => {
    expect(parseCraftFloor(undefined)).toBe(null);
  });

  it('parses a valid 0–100 integer', () => {
    expect(parseCraftFloor('40')).toBe(40);
    expect(parseCraftFloor('0')).toBe(0);
    expect(parseCraftFloor('100')).toBe(100);
  });

  it('rejects a bare flag with no number', () => {
    expect(parseCraftFloor(true)).toBe('invalid');
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(parseCraftFloor('40.5')).toBe('invalid');
    expect(parseCraftFloor('-1')).toBe('invalid');
    expect(parseCraftFloor('101')).toBe('invalid');
    expect(parseCraftFloor('abc')).toBe('invalid');
    expect(parseCraftFloor('')).toBe('invalid');
  });
});

describe('evaluateGate', () => {
  it('passes a clean run', () => {
    const r = evaluateGate([report({})], { strict: false, craftFloor: null });
    expect(r.failed).toBe(false);
    expect(r.correctnessFailed).toBe(false);
    expect(r.craftBreaches).toEqual([]);
  });

  it('fails on errors (correctness gate, always on)', () => {
    const r = evaluateGate([report({ error: 1 })], { strict: false, craftFloor: null });
    expect(r.failed).toBe(true);
    expect(r.correctnessFailed).toBe(true);
  });

  it('passes warnings by default, fails them under --strict', () => {
    const reports = [report({ warning: 2 })];
    expect(evaluateGate(reports, { strict: false, craftFloor: null }).failed).toBe(false);
    expect(evaluateGate(reports, { strict: true, craftFloor: null }).failed).toBe(true);
  });

  it('never gates craft without a floor, even at craft 0', () => {
    const r = evaluateGate([report({ craft: 0 })], { strict: false, craftFloor: null });
    expect(r.failed).toBe(false);
    expect(r.craftBreaches).toEqual([]);
  });

  it('fails a file below the craft floor, keeping correctness untouched', () => {
    const r = evaluateGate([report({ craft: 20, filename: 'Generic.svelte' })], {
      strict: false,
      craftFloor: 40
    });
    expect(r.failed).toBe(true);
    expect(r.correctnessFailed).toBe(false); // craft alone fails it
    expect(r.craftBreaches).toEqual([{ label: 'Generic.svelte', craft: 20 }]);
  });

  it('gates per file — one generic page cannot hide behind clean ones', () => {
    const reports = [
      report({ craft: 100, filename: 'A.svelte' }),
      report({ craft: 10, filename: 'B.svelte' }),
      report({ craft: 100, filename: 'C.svelte' })
    ];
    const r = evaluateGate(reports, { strict: false, craftFloor: 50 });
    expect(r.failed).toBe(true);
    expect(r.craftBreaches).toEqual([{ label: 'B.svelte', craft: 10 }]);
  });

  it('treats a score exactly at the floor as passing (floor is a minimum)', () => {
    const r = evaluateGate([report({ craft: 40 })], { strict: false, craftFloor: 40 });
    expect(r.failed).toBe(false);
    expect(r.craftBreaches).toEqual([]);
  });

  it('sums counts across files', () => {
    const r = evaluateGate([report({ error: 1, warning: 1 }), report({ error: 2, info: 3 })], {
      strict: false,
      craftFloor: null
    });
    expect(r.totals).toEqual({ error: 3, warning: 1, info: 3 });
  });
});
