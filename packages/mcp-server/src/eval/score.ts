/**
 * Scoring + A/B reporting for the eval-suite. The linter half is deterministic
 * (no LLM): `scoreImplementation` runs the design-linter and returns the score
 * and finding counts. The rubric half is judge-supplied (1–5 per criterion);
 * `aggregateRubric` validates and sums it. `formatAbReport` renders the
 * baseline-vs-treatment comparison as per-brief rows plus an aggregate.
 *
 * Compare arms *within* one round only. Rubric and capture rules have changed
 * between rounds, and a delta taken across such a change measures the rule, not
 * the arm.
 */

import { lintDesign } from '@urbicon-ui/design-engine/linter';
import { MAX_RUBRIC_SCORE, RUBRIC_CRITERIA } from '@urbicon-ui/design-engine/rubric';

export interface LinterScore {
  /**
   * Stage-1 correctness axis, 0–100 (deterministic defects only). The stable A/B
   * headline metric: unaffected by the craft heuristics, so adding or tuning
   * those does not move it.
   */
  correctness: number;
  /** Stage-2 craft axis, 0–100 (system-agnostic "looks generic" heuristics). */
  craft: number;
  errors: number;
  warnings: number;
  infos: number;
}

export interface ImplementationScore {
  linter: LinterScore;
  /** Judge rubric total /MAX_RUBRIC_SCORE, when a rubric pass was run. */
  rubricTotal?: number;
}

export interface EvalEntry {
  briefId: string;
  /** e.g. "baseline" or "design-mcp". */
  condition: string;
  score: ImplementationScore;
}

/** Deterministic linter score for one generated implementation. */
export function scoreImplementation(code: string): LinterScore {
  const r = lintDesign(code);
  return {
    correctness: r.scores.correctness,
    craft: r.scores.craft,
    errors: r.counts.error,
    warnings: r.counts.warning,
    infos: r.counts.info
  };
}

/** Validate + sum a judge's per-criterion 1–5 scores into a /40 total. Missing/out-of-range entries throw. */
export function aggregateRubric(perCriterion: Record<string, number>): number {
  let total = 0;
  for (const c of RUBRIC_CRITERIA) {
    const v = perCriterion[c.id];
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 1 || v > 5) {
      throw new Error(`Rubric score for "${c.id}" must be a finite 1–5, got ${v}`);
    }
    total += v;
  }
  return total;
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(from: number, to: number): string {
  if (from === 0) return '—';
  const change = ((to - from) / from) * 100;
  return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
}

/**
 * Render a baseline-vs-treatment A/B report. `baseline` and `treatment` are the
 * condition labels present in `entries`. Per-brief rows + an aggregate summary.
 */
export function formatAbReport(entries: EvalEntry[], baseline: string, treatment: string): string {
  const briefIds = [...new Set(entries.map((e) => e.briefId))];
  const pick = (briefId: string, condition: string) =>
    entries.find((e) => e.briefId === briefId && e.condition === condition)?.score;

  let md = `# Eval A/B — ${baseline} vs ${treatment}\n\n`;
  md += '## Per-brief\n\n';
  md += `| Brief | ${baseline} correctness | ${treatment} correctness | ${baseline} rubric | ${treatment} rubric |\n`;
  md += '|---|---|---|---|---|\n';

  const baseLint: number[] = [];
  const treatLint: number[] = [];
  const baseCraft: number[] = [];
  const treatCraft: number[] = [];
  const baseRub: number[] = [];
  const treatRub: number[] = [];

  for (const id of briefIds) {
    const b = pick(id, baseline);
    const t = pick(id, treatment);
    if (b) {
      baseLint.push(b.linter.correctness);
      baseCraft.push(b.linter.craft);
    }
    if (t) {
      treatLint.push(t.linter.correctness);
      treatCraft.push(t.linter.craft);
    }
    if (b?.rubricTotal !== undefined) baseRub.push(b.rubricTotal);
    if (t?.rubricTotal !== undefined) treatRub.push(t.rubricTotal);
    const rub = (s?: ImplementationScore) =>
      s?.rubricTotal !== undefined ? `${s.rubricTotal}/${MAX_RUBRIC_SCORE}` : '—';
    md += `| ${id} | ${b?.linter.correctness ?? '—'} | ${t?.linter.correctness ?? '—'} | ${rub(b)} | ${rub(t)} |\n`;
  }

  md += '\n## Aggregate\n\n';
  md += `| Metric | ${baseline} | ${treatment} | Δ |\n|---|---|---|---|\n`;
  md += `| Mean correctness | ${mean(baseLint).toFixed(1)} | ${mean(treatLint).toFixed(1)} | ${pct(mean(baseLint), mean(treatLint))} |\n`;
  md += `| Mean craft | ${mean(baseCraft).toFixed(1)} | ${mean(treatCraft).toFixed(1)} | ${pct(mean(baseCraft), mean(treatCraft))} |\n`;
  if (baseRub.length && treatRub.length) {
    md += `| Mean rubric /${MAX_RUBRIC_SCORE} | ${mean(baseRub).toFixed(1)} | ${mean(treatRub).toFixed(1)} | ${pct(mean(baseRub), mean(treatRub))} |\n`;
  }
  const totalErr = (cond: string) =>
    entries
      .filter((e) => e.condition === cond)
      .reduce((a, e) => a + e.score.linter.errors + e.score.linter.warnings, 0);
  md += `| Total linter errors+warnings | ${totalErr(baseline)} | ${totalErr(treatment)} | ${pct(totalErr(baseline), totalErr(treatment))} |\n`;

  return md;
}
