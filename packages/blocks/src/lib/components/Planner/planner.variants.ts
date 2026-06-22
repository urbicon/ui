import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * Planner styling — the visible chrome layered over the headless `DateGridScaffold`.
 *
 * Slots cover the toolbar, the weekday header, week rows and the day cell. Cell
 * *state* (today / selected / weekend / outside-range) is applied as conditional
 * classes in the markup rather than as boolean variants, to keep the variant
 * matrix to the three axes that actually change layout: `view`, `variant`, `size`.
 */
export const plannerVariants = tv({
  slots: {
    base: 'w-full flex flex-col',

    // Header / toolbar
    header: ['flex items-center justify-between gap-2', 'border-b border-border-hairline'],
    headerTitle: 'font-semibold text-text-primary select-none tabular-nums',
    nav: 'flex items-center gap-1',
    navButton: [
      'inline-flex items-center justify-center rounded-md',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed'
    ],

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
    cellDate:
      'inline-flex items-center justify-center font-medium tabular-nums leading-none select-none',
    cellItems: 'flex flex-col gap-1 min-w-0',
    empty: 'text-text-quaternary select-none'
  },
  variants: {
    view: {
      week: {
        // 7 card columns on desktop; Planner stacks them on mobile via scaffold classes.
        cell: 'min-h-32 p-2 border border-border-subtle rounded-lg h-full',
        weekday: 'pb-2'
      },
      month: {
        // Continuous grid: shared borders, no gap.
        cell: 'min-h-24 p-1.5 border-t border-l h-full',
        weekday: 'pb-2'
      },
      range: {
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
        header: 'py-2',
        headerTitle: 'text-sm',
        navButton: 'h-7 w-7',
        weekday: 'text-xs',
        weekNumber: 'text-[0.65rem]',
        cellDate: 'text-xs h-5 min-w-5',
        cellWeekday: 'text-xs',
        cellItems: 'text-xs',
        empty: 'text-xs'
      },
      md: {
        header: 'py-3',
        headerTitle: 'text-base',
        navButton: 'h-8 w-8',
        weekday: 'text-sm',
        weekNumber: 'text-xs',
        cellDate: 'text-sm h-6 min-w-6',
        cellWeekday: 'text-xs',
        cellItems: 'text-sm',
        empty: 'text-sm'
      },
      lg: {
        header: 'py-4',
        headerTitle: 'text-lg',
        navButton: 'h-9 w-9',
        weekday: 'text-base',
        weekNumber: 'text-sm',
        cellDate: 'text-base h-7 min-w-7',
        cellWeekday: 'text-sm',
        cellItems: 'text-base',
        empty: 'text-base'
      }
    }
  },
  defaultVariants: {
    view: 'week',
    variant: 'default',
    size: 'md'
  }
});

export type PlannerVariants = VariantProps<typeof plannerVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type PlannerSlots = SlotNames<typeof plannerVariants>;
