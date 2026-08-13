/**
 * Headless date-grid core (INTERNAL — not exported from the package).
 *
 * Shared mechanics for cell-based date views: the `DateGridController` state
 * class, its context, the keyboard handler and the `DateGridScaffold` chrome.
 * Consumed by Calendar, Planner and ResourceTimeline; see
 * docs/ARCHITECTURE.md → "Date & planning infrastructure" for why it stays
 * internal for now.
 *
 * Two types defined here ARE public — `DateRange` and `DateCategory` — but they
 * reach consumers through the surfaces that share them (Calendar, Planner,
 * ResourceTimeline re-export them from their own `index.ts`), never through this
 * module. See `date-grid.types.ts` for the twins they replaced.
 */

export { default as DateGridScaffold } from './DateGridScaffold.svelte';
export { getDateGridContext, setDateGridContext } from './date-grid.context';
export { type DateGridKeyboardTarget, handleDateGridKeydown } from './date-grid.keyboard';
export { DateGridController, type DateGridOptions } from './date-grid.svelte';
export type {
  DateCategory,
  DateGridContext,
  DateGridSelection,
  DateGridSelectionMode,
  DateGridView,
  DateRange,
  DayCellInfo,
  DayHeaderInfo,
  NavDirection
} from './date-grid.types';
export { type PackedSpan, packSpans } from './pack-spans';
