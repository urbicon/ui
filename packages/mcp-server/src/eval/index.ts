/**
 * Public API of the eval-suite (docs/DESIGN-MCP.md, cross-cutting eval). The
 * briefs and the deterministic scorer are reusable across runs; the LLM
 * generation and rubric judging are injected by whoever drives a run (an agent
 * harness this round, an API loop later) so the suite stays automation-friendly.
 */

export type { EvalBrief } from './briefs.js';
export { EVAL_BRIEFS, getBriefById } from './briefs.js';
export type { EvalEntry, ImplementationScore, LinterScore } from './score.js';
export { aggregateRubric, formatAbReport, scoreImplementation } from './score.js';
