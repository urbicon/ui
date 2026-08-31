import {
  dateGridHeaderSizes,
  dateGridHeaderSlots
} from '$lib/internal/core/date-grid-header-slots';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * The week view's stacking rules — structure, not decoration.
 *
 * Below `md` the weekday row is dropped and each week row collapses to one
 * column, so the weekday and the date move into every cell; from `md` up the
 * cell header hides again because the row above carries them. Take any one of
 * the three away and both copies print at once, at every width.
 *
 * `unstyled` keeps exactly this map (`Planner.svelte` indexes it) and the
 * `view: 'week'` axis is assembled from it below, so a key added here reaches
 * both paths. That assembly is also what checks the keys: they land in the
 * axis, where the engine's `ValidSlotVariants` rejects a name that is not a
 * slot. The widening assignment in `Planner.svelte` checks nothing — a named
 * constant gets no excess-property check — so keep the assembly, not a second
 * assertion, as the thing that holds the keys to the slot roster.
 */
export const plannerWeekStacking: Record<'weekdayHeader' | 'week' | 'cellHeader', string> = {
  weekdayHeader: 'max-md:hidden',
  week: 'max-md:grid-cols-1',
  cellHeader: 'md:hidden'
};

/**
 * Merges the stacking map into the rest of the week view's slot classes, so
 * every key of `plannerWeekStacking` reaches the axis by construction.
 *
 * Naming three of them by hand left the other direction open: a fourth
 * stacking key was read by `Planner.svelte`'s `unstyled` branch and by nothing
 * else, so `unstyled` painted a class the styled path never had. Merging
 * rather than spreading, because a stacking key that also carries decoration
 * has to keep both.
 */
function withWeekStacking<T extends Record<string, string>>(
  decoration: T
): T & Record<keyof typeof plannerWeekStacking, string> {
  const slots: Record<string, string> = { ...decoration };
  for (const [slot, structural] of Object.entries(plannerWeekStacking)) {
    slots[slot] = [structural, slots[slot]].filter(Boolean).join(' ');
  }
  return slots as T & Record<keyof typeof plannerWeekStacking, string>;
}

/** The `view: 'week'` slot map — decoration here, structure from the map above. */
const weekViewSlots = withWeekStacking({
  cell: 'min-h-32 p-2 border border-border-subtle rounded-lg h-full',
  weekday: 'pb-2',
  // Decoration on the stacked rows: `unstyled` drops it and keeps the
  // structure.
  weekdayHeader: 'gap-2',
  week: 'gap-2'
});

/**
 * Planner styling — the visible chrome layered over the headless `DateGridScaffold`.
 *
 * Slots cover the toolbar, the weekday header, week rows and the day cell.
 *
 * Every class that lands on a slot is declared here, the view-conditional and
 * the per-cell-state ones included. A conditional class written in the markup
 * instead lands in one of two positions where nothing strips it — after the
 * fold, or inside the consumer's own source — so it and a colliding consumer
 * entry both survive and the stylesheet picks the winner (#349). Five class
 * strings in `Planner.svelte` sit on elements no slot addresses (the live
 * region, the day-header wrapper and its date, the gridcell, the item-count
 * badge); an element with no slot has no consumer entry to collide with, and
 * giving it one is an API decision, not a fold repair.
 *
 * Three axes are props (`view`, `variant`, `size`). The four cell-state axes
 * are passed per cell to the slot function and are `Omit`ted from
 * `PlannerProps` — a prop for them would offer the consumer a whole-grid switch
 * for something that differs per day.
 */
export const plannerVariants = tv({
  slots: {
    base: 'w-full flex flex-col',

    // Header / toolbar — the bar itself is the shared CoreDateGridHeader, and
    // so is its look: one copy in internal/core/date-grid-header-slots, spread
    // here so the four slots stay part of Planner's own slotClasses surface.
    ...dateGridHeaderSlots,

    // Grid scaffolding
    grid: 'w-full',
    weekdayHeader: '',
    weekday: 'text-center font-medium text-text-tertiary select-none truncate',
    weekNumber:
      'flex items-center justify-center text-text-quaternary select-none tabular-nums italic',

    // Day cell
    week: '',
    cell: [
      'group/cell relative flex flex-col gap-1 text-left align-top',
      'border-border-hairline',
      'transition-colors duration-[var(--blocks-duration-fast)]'
    ],
    cellHeader: 'flex items-baseline justify-between gap-1',
    cellWeekday: 'text-text-tertiary font-medium select-none',
    // `text-text-secondary` is the unmarked day — the `dayState` axis below
    // replaces it for today and for a blocked day.
    cellDate: [
      'inline-flex items-center justify-center font-medium tabular-nums leading-none select-none',
      'text-text-secondary'
    ],
    cellItems: 'flex flex-col gap-1 min-w-0',
    empty: 'text-text-quaternary select-none'
  },
  variants: {
    view: {
      // Seven card columns on desktop, stacked below `md` — see `weekViewSlots`.
      week: weekViewSlots,
      month: {
        // Continuous grid: shared borders, no gap. The right and bottom edges
        // close the frame the cells' top/left borders leave open.
        grid: 'border-border-subtle border-r border-b',
        cell: 'min-h-24 p-1.5 border-t border-l h-full',
        weekday: 'pb-2'
      },
      range: {
        grid: 'border-border-subtle border-r border-b',
        cell: 'min-h-24 p-1.5 border-t border-l h-full',
        weekday: 'pb-2'
      }
    },
    variant: {
      default: { base: '' },
      bordered: { base: 'border border-border-subtle rounded-xl p-3' },
      ghost: { cell: 'border-transparent' }
    },
    size: {
      sm: {
        ...dateGridHeaderSizes.sm,
        weekday: 'text-xs',
        weekNumber: 'text-3xs',
        cellDate: 'text-xs h-5 min-w-5',
        cellWeekday: 'text-xs',
        cellItems: 'text-xs',
        empty: 'text-xs'
      },
      md: {
        ...dateGridHeaderSizes.md,
        weekday: 'text-sm',
        weekNumber: 'text-xs',
        cellDate: 'text-sm h-6 min-w-6',
        cellWeekday: 'text-xs',
        cellItems: 'text-sm',
        empty: 'text-sm'
      },
      lg: {
        ...dateGridHeaderSizes.lg,
        weekday: 'text-base',
        weekNumber: 'text-sm',
        cellDate: 'text-base h-7 min-w-7',
        cellWeekday: 'text-sm',
        cellItems: 'text-base',
        empty: 'text-base'
      }
    },

    // ── Per-cell state ──────────────────────────────────────────────────────
    // Resolved at the slot call (`styles.cell({ selected, … })`), not from a
    // prop. Every source here precedes the consumer's entry, which is the
    // override rung and strips all of it — measured: with
    // `slotClasses.cell = 'ring-0 bg-transparent opacity-100'` a selected
    // weekend day kept `ring-2` and `bg-surface-subtle` beside it before, and
    // loses both now.

    /**
     * Exclusive ladder for the day: blocked outranks today. `today` is what
     * `highlightToday` switches on and off, so a caller that turns the marker
     * off passes `'default'`.
     */
    dayState: {
      default: {},
      today: { cellDate: 'bg-primary text-text-on-primary rounded-full' },
      // Shipping minDate/maxDate/disabledDates without the cell half left a
      // blocked day looking exactly like a bookable one — same surface, same
      // border, same date colour, same cursor — with `aria-disabled` the only
      // difference.
      disabled: {
        cell: 'opacity-40 cursor-not-allowed',
        cellDate: 'text-text-disabled'
      }
    },
    /** Single selection; combines with every other state. */
    selected: {
      true: { cell: 'ring-2 ring-primary ring-inset z-10' },
      false: {}
    },
    /** Saturday/Sunday, and only while `highlightWeekend` is on. */
    weekend: {
      true: { cell: 'bg-surface-subtle' },
      false: {}
    },
    /** Outside the month (month view) or the window (range view). */
    outside: {
      true: { cell: 'opacity-40' },
      false: {}
    }
  },
  defaultVariants: {
    view: 'week',
    variant: 'default',
    size: 'md',
    dayState: 'default',
    selected: false,
    weekend: false,
    outside: false
  }
});

export type PlannerVariants = VariantProps<typeof plannerVariants>;
/**
 * The axes a single day cell varies on. Passed to the slot function per cell,
 * never taken as a prop — `PlannerProps` omits exactly these keys, and the
 * assertion beside that omission holds the two together.
 */
export type PlannerCellState = Pick<
  PlannerVariants,
  'dayState' | 'selected' | 'weekend' | 'outside'
>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type PlannerSlots = SlotNames<typeof plannerVariants>;
