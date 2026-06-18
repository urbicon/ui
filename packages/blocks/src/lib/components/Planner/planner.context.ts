import { createOptionalContext } from '$lib/utils/optional-context';
import type { PlannerContext } from './planner.types';

// Optional context so the getter can throw a descriptive error rather than
// Svelte's generic missing_context.
const [getPlannerContextRaw, setPlannerContext] = createOptionalContext<PlannerContext>();

export { setPlannerContext };

/** Read the Planner context. Throws if used outside a `<Planner>`. */
export function getPlannerContext(): PlannerContext {
  const ctx = getPlannerContextRaw();
  if (!ctx) {
    throw new Error('PlannerHeader and its siblings must be used inside a <Planner>.');
  }
  return ctx;
}
