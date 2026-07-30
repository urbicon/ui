/**
 * Public API of the Urbicon UI design linter.
 *
 * The linter is the deterministic half of the "generate → validate → fix" loop
 * (docs/internal/DESIGN-MCP.md, Option B). It is consumed by the `validate_design` MCP
 * tool and, programmatically, by the eval-suite (WP5) which scores generated
 * pages without an LLM in the loop.
 */

export { HEURISTIC_RULE_IDS, HEURISTIC_THRESHOLDS } from './heuristics.js';
export { CRAFT_PENALTY, lintDesign, maskComments, SCORE_WEIGHTS } from './linter.js';
export { RULES } from './rules.js';
export { buildCodeView } from './scope.js';
export { INVALID_SUPPRESSION_ID, knownRuleIds } from './suppress.js';
export { VALID_TOKEN_CORES } from './tokens.js';
export type {
  Finding,
  FindingKind,
  LintContext,
  LintMode,
  LintOptions,
  LintReport,
  LintScores,
  Rule,
  RuleScope,
  Severity,
  SuppressedRule
} from './types.js';
