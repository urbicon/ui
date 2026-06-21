/**
 * Public API of the design-quality rubric — the qualitative half of the design loop
 * (docs/DESIGN-MCP.md, step 3). Consumed by the `get_design_principles(as="rubric")`
 * MCP tool and by the eval-suite, which import the same constants to score programmatically.
 *
 * See ./rubric.ts for the criteria and the rationale behind them.
 */

export type { RubricCriterion } from './rubric.js';
export { MAX_RUBRIC_SCORE, RUBRIC_CRITERIA, renderRubric } from './rubric.js';
