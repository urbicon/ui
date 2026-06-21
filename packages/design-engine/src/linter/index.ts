/**
 * Public API of the Urbicon UI design linter.
 *
 * The linter is the deterministic half of the "generate → validate → fix" loop
 * (docs/DESIGN-MCP.md, Option B). It is consumed by the `validate_design` MCP
 * tool and, programmatically, by the eval-suite (WP5) which scores generated
 * pages without an LLM in the loop.
 */

export { HEURISTIC_THRESHOLDS } from './heuristics.js';
export { lintDesign, maskComments, SCORE_WEIGHTS, SLOP_WEIGHT } from './linter.js';
export { RULES } from './rules.js';
export { VALID_TOKEN_CORES } from './tokens.js';
export type {
  Finding,
  FindingKind,
  LintContext,
  LintOptions,
  LintReport,
  LintScores,
  Rule,
  Severity
} from './types.js';
