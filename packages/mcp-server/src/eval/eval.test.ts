import { RUBRIC_CRITERIA } from '@urbicon-ui/design-engine/rubric';
import { describe, expect, it } from 'vitest';
import { EVAL_BRIEFS, getBriefById } from './briefs.js';
import type { EvalEntry } from './score.js';
import { aggregateRubric, formatAbReport, scoreImplementation } from './score.js';

describe('eval briefs', () => {
  it('provides ~10 briefs with unique ids', () => {
    expect(EVAL_BRIEFS.length).toBeGreaterThanOrEqual(10);
    expect(new Set(EVAL_BRIEFS.map((b) => b.id)).size).toBe(EVAL_BRIEFS.length);
  });
  it('only references real composition patterns', () => {
    const known = new Set([
      'dashboard',
      'form-page',
      'settings-page',
      'tab-navigation',
      'onboarding-guide'
    ]);
    for (const b of EVAL_BRIEFS) {
      if (b.pattern) expect(known, `${b.id} → ${b.pattern}`).toContain(b.pattern);
    }
  });
  it('looks up by id', () => {
    expect(getBriefById('ops-dashboard')?.title).toBe('Ops Dashboard');
    expect(getBriefById('nope')).toBeUndefined();
  });
});

describe('scoreImplementation', () => {
  it('scores clean code 100 with no findings', () => {
    const s = scoreImplementation('<div class="bg-surface-base text-text-primary">ok</div>');
    expect(s.score).toBe(100);
    expect(s.errors).toBe(0);
  });
  it('penalises hallucinated tokens and raw colours', () => {
    const s = scoreImplementation('<div class="bg-blue-500 text-status-bad">x</div>');
    expect(s.score).toBeLessThan(100);
    expect(s.errors + s.warnings).toBeGreaterThan(0);
  });
});

describe('aggregateRubric', () => {
  const full = Object.fromEntries(RUBRIC_CRITERIA.map((c) => [c.id, 4]));

  it('sums a complete 1–5 score set', () => {
    expect(aggregateRubric(full)).toBe(RUBRIC_CRITERIA.length * 4);
  });
  it('throws on a missing, out-of-range, or non-finite criterion', () => {
    expect(() => aggregateRubric({ ...full, correctness: 7 })).toThrow();
    expect(() => aggregateRubric({ ...full, correctness: NaN })).toThrow();
    const { correctness, ...missing } = full;
    void correctness;
    expect(() => aggregateRubric(missing)).toThrow();
  });
});

describe('formatAbReport edge cases', () => {
  it('reports a clean-baseline error delta as "—", not a false percentage', () => {
    const entries: EvalEntry[] = [
      {
        briefId: 'x',
        condition: 'baseline',
        score: { linter: { score: 100, errors: 0, warnings: 0, infos: 0 } }
      },
      {
        briefId: 'x',
        condition: 'design-mcp',
        score: { linter: { score: 100, errors: 0, warnings: 0, infos: 0 } }
      }
    ];
    const report = formatAbReport(entries, 'baseline', 'design-mcp');
    expect(report).not.toContain('-100.0%');
  });
});

describe('formatAbReport', () => {
  const entries: EvalEntry[] = [
    {
      briefId: 'a',
      condition: 'baseline',
      score: { linter: { score: 70, errors: 1, warnings: 2, infos: 0 }, rubricTotal: 22 }
    },
    {
      briefId: 'a',
      condition: 'design-mcp',
      score: { linter: { score: 95, errors: 0, warnings: 0, infos: 1 }, rubricTotal: 31 }
    }
  ];
  const report = formatAbReport(entries, 'baseline', 'design-mcp');

  it('renders per-brief and aggregate sections with a delta', () => {
    expect(report).toContain('## Per-brief');
    expect(report).toContain('## Aggregate');
    expect(report).toContain('baseline');
    expect(report).toContain('design-mcp');
    expect(report).toContain('%'); // a percentage delta is present
  });
});
