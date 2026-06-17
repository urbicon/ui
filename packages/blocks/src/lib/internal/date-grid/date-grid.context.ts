import { createOptionalContext } from '$lib/utils/optional-context';
import type { DateGridContext } from './date-grid.types';

// Optional helper so the getter below can throw a descriptive error instead of
// Svelte's generic missing_context.
const [getDateGridContextRaw, setDateGridContext] = createOptionalContext<DateGridContext>();

export { setDateGridContext };

/**
 * Read the date-grid context. Throws if no `Calendar`/`Planner` provider set it.
 */
export function getDateGridContext(): DateGridContext {
  const ctx = getDateGridContextRaw();
  if (!ctx) {
    throw new Error(
      'DateGridScaffold and its sub-components must be used inside a date-grid provider (Calendar or Planner).'
    );
  }
  return ctx;
}
