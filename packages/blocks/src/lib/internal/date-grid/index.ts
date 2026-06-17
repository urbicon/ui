/**
 * Headless date-grid core (INTERNAL — not exported from the package).
 *
 * Shared mechanics for cell-based date views: the `DateGridController` state
 * class, its context, the keyboard handler and the `DateGridScaffold` chrome.
 * Consumed by Calendar and Planner; see docs/DATEGRID-PLANNER-PLAN.md (D6) for
 * why it stays internal for now.
 */

export { default as DateGridScaffold } from './DateGridScaffold.svelte';
export { getDateGridContext, setDateGridContext } from './date-grid.context';
export { type DateGridKeyboardTarget, handleDateGridKeydown } from './date-grid.keyboard';
export { DateGridController, type DateGridOptions } from './date-grid.svelte';
export type {
  DateGridContext,
  DateGridRange,
  DateGridSelection,
  DateGridSelectionMode,
  DateGridView,
  DayCellInfo,
  DayHeaderInfo,
  NavDirection
} from './date-grid.types';
