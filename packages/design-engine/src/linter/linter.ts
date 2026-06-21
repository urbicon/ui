/**
 * The design linter engine: masks comments, runs the deterministic rules and the
 * distribution heuristics, and reduces the findings to a 0–100 score. Pure and
 * dependency-free so it is trivially unit-testable (one of the explicit wins of
 * a linter over prose guidance — see docs/DESIGN-MCP.md, Option B).
 */

import { runHeuristics } from './heuristics.js';
import { RULES } from './rules.js';
import { resolveValidTokenCores } from './tokens.js';
import type {
  Finding,
  LintContext,
  LintOptions,
  LintReport,
  LintScores,
  Severity
} from './types.js';

/**
 * Per-severity deduction on the **correctness** axis. Errors dominate (real
 * defects), warnings are softer (likely-but-not-certain). Centralised for tuning.
 */
export const SCORE_WEIGHTS: Record<Severity, number> = {
  error: 10,
  warning: 5,
  info: 2
};

/**
 * Flat deduction per slop-floor heuristic on the **slop** axis. Unlike correctness
 * defects (counted per occurrence — every raw colour is its own bug), each slop
 * heuristic fires at most once and is one holistic judgement about the page, so
 * one flat weight regardless of repetition. Tuned so a page tripping ~5 distinct
 * slop signals lands mid-scale (≈50). Kept separate from SCORE_WEIGHTS so the two
 * axes can be tuned independently.
 */
export const SLOP_WEIGHT = 10;

/**
 * Blank out comment bodies while preserving newlines (so line numbers stay
 * correct) — keeps the rules from firing on `focus:` in a `<!-- … -->` note or a
 * `/* … *\/` block. Line comments are intentionally left alone: masking `//`
 * safely (without eating `https://`) is not worth the complexity for v1.
 */
export function maskComments(code: string): string {
  const blankKeepNewlines = (s: string) => s.replace(/[^\n]/g, ' ');
  return code
    .replace(/<!--[\s\S]*?-->/g, blankKeepNewlines)
    .replace(/\/\*[\s\S]*?\*\//g, blankKeepNewlines);
}

const SEVERITY_ORDER: Record<Severity, number> = { error: 0, warning: 1, info: 2 };

/** Lint one code unit. Returns findings, a score, and severity counts. */
export function lintDesign(code: string, opts: LintOptions = {}): LintReport {
  const masked = maskComments(code);
  const lines = masked.split('\n');

  // Resolve the effective whitelist once per call (built-in cores + opts.extraTokens),
  // then hand every rule the same context. Rules that need no context ignore it.
  const ctx: LintContext = { validTokenCores: resolveValidTokenCores(opts.extraTokens) };

  const findings: Finding[] = [];
  for (const rule of RULES) {
    findings.push(...rule.check(lines, masked, ctx));
  }
  if (!opts.skipHeuristics) {
    findings.push(...runHeuristics(masked));
  }

  findings.sort((a, b) => {
    const lineDiff = (a.line ?? Infinity) - (b.line ?? Infinity);
    if (lineDiff !== 0) return lineDiff;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  // Two axes, never mixed (§6): deterministic findings deduct from correctness
  // (per occurrence, weighted by severity), heuristic findings from slop (flat per
  // finding). `kind`, not `severity`, decides the axis — so a future deterministic
  // `info` would still score against correctness, where it belongs.
  const counts = { error: 0, warning: 0, info: 0 };
  let correctnessDeduction = 0;
  let slopDeduction = 0;
  for (const f of findings) {
    counts[f.severity]++;
    if (f.kind === 'heuristic') slopDeduction += SLOP_WEIGHT;
    else correctnessDeduction += SCORE_WEIGHTS[f.severity];
  }
  const scores: LintScores = {
    correctness: Math.max(0, 100 - correctnessDeduction),
    slop: Math.max(0, 100 - slopDeduction)
  };

  return { findings, scores, counts, filename: opts.filename };
}
