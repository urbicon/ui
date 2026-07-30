/**
 * The design linter engine: masks comments, runs the deterministic rules and the
 * distribution heuristics, and reduces the findings to a 0–100 score. Pure and
 * dependency-free so it is trivially unit-testable (one of the explicit wins of
 * a linter over prose guidance — see docs/internal/DESIGN-MCP.md, Option B).
 */

import { runHeuristics } from './heuristics.js';
import { RULES } from './rules.js';
import { buildCodeView } from './scope.js';
import { applySuppressions, collectSuppressions } from './suppress.js';
import { resolveValidTokenCores } from './tokens.js';
import type {
  Finding,
  LintContext,
  LintMode,
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
 * Flat deduction per craft heuristic on the **craft** axis. Unlike correctness
 * defects (counted per occurrence — every raw colour is its own bug), each craft
 * heuristic fires at most once and is one holistic judgement about the page, so
 * one flat penalty regardless of repetition. Tuned so a page tripping ~5 distinct
 * craft notes lands mid-scale (≈50). Kept separate from SCORE_WEIGHTS so the two
 * axes can be tuned independently. A deduction, not a virtue — the name says which
 * direction it moves the score.
 */
export const CRAFT_PENALTY = 10;

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

/** File extensions read as plain TS/JS modules (`mode: 'code'`) rather than markup. */
const CODE_EXTENSION_RE = /\.(?:[mc]?[jt]s|[jt]sx)$/i;

/** Explicit option first, then the filename extension, else markup. */
function resolveMode(opts: LintOptions): LintMode {
  if (opts.mode) return opts.mode;
  return opts.filename !== undefined && CODE_EXTENSION_RE.test(opts.filename) ? 'code' : 'markup';
}

/** Lint one code unit. Returns findings, a score, and severity counts. */
export function lintDesign(code: string, opts: LintOptions = {}): LintReport {
  const masked = maskComments(code);
  const lines = masked.split('\n');

  // The code view for the `'code'`-scoped rules: class attributes + code
  // literals kept, prose text content blanked (see scope.ts). Same length and
  // line structure as the source, so findings keep their real line numbers.
  const codeView = buildCodeView(code, resolveMode(opts));
  const codeViewLines = codeView.split('\n');

  // Resolve the effective whitelist once per call (built-in cores + opts.extraTokens),
  // then hand every rule the same context. Rules that need no context ignore it.
  const ctx: LintContext = { validTokenCores: resolveValidTokenCores(opts.extraTokens) };

  // Exemptions: in-file `urbicon-ignore` pragmas (parsed from the raw source —
  // they live in comments) merged with caller-supplied suppressRules (the
  // manifest `## Exempt` channel). Misuse becomes a loud warning finding.
  const suppression = collectSuppressions(code, opts.suppressRules);

  const findings: Finding[] = [];
  for (const rule of RULES) {
    const scoped = rule.scope === 'code';
    findings.push(...rule.check(scoped ? codeViewLines : lines, scoped ? codeView : masked, ctx));
  }
  if (!opts.skipHeuristics) {
    findings.push(...runHeuristics(masked));
  }
  findings.push(...suppression.findings);

  const { kept, suppressed } = applySuppressions(findings, suppression);

  kept.sort((a, b) => {
    const lineDiff = (a.line ?? Infinity) - (b.line ?? Infinity);
    if (lineDiff !== 0) return lineDiff;
    return SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  });

  // Two axes, never mixed (§6): deterministic findings deduct from correctness
  // (per occurrence, weighted by severity), heuristic findings from craft (flat per
  // finding). `kind`, not `severity`, decides the axis — so a future deterministic
  // `info` would still score against correctness, where it belongs. Suppressed
  // findings are already partitioned out: they neither count nor score, but stay
  // visible in `report.suppressed`.
  const counts = { error: 0, warning: 0, info: 0 };
  let correctnessDeduction = 0;
  let craftDeduction = 0;
  for (const f of kept) {
    counts[f.severity]++;
    if (f.kind === 'heuristic') craftDeduction += CRAFT_PENALTY;
    else correctnessDeduction += SCORE_WEIGHTS[f.severity];
  }
  const scores: LintScores = {
    correctness: Math.max(0, 100 - correctnessDeduction),
    craft: Math.max(0, 100 - craftDeduction)
  };

  const report: LintReport = { findings: kept, scores, counts, filename: opts.filename };
  if (suppressed.length > 0) report.suppressed = suppressed;
  return report;
}
