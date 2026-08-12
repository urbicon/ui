import {
  dateGridHeaderSizes,
  dateGridHeaderSlots
} from '$lib/internal/core/date-grid-header-slots';
import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

/**
 * ResourceTimeline styling — a sticky resource column over a horizontally
 * scrolling day track.
 *
 * **The geometry runs on CSS custom properties, on purpose.** `--rt-lane-w`,
 * `--rt-day-w`, `--rt-bar-h`, `--rt-bar-gap`, `--rt-bar-top` and
 * `--rt-bar-inset` are declared here (per `size`) and consumed by the row
 * template, the cell height and every bar's `calc()`. The component adds only
 * the two values it alone knows — `--rt-cols` (the grid template, whose
 * `repeat()` count cannot come from a `var()`) and `--rt-min-w` — as an inline
 * style on the track, plus `--rt-rows` per lane and `--rt-span`/`--rt-row` per
 * bar. So a consumer re-tunes density by overriding one custom property instead
 * of restating a template.
 *
 * **`overflow-x` lives on `track`, never on `base`.** The root must not be able
 * to scroll the page sideways — the failure the Calendar header's unwrapped nav
 * already caused once on a phone (see calendar.variants.ts:8-11).
 *
 * Cell *state* (today / weekend / disabled / occupied) is applied as conditional
 * classes in the markup, not as boolean variants, keeping the matrix to the two
 * axes that change layout: `variant` and `size`. Same call as Planner's.
 */
export const resourceTimelineVariants = tv({
  slots: {
    base: 'w-full flex flex-col',

    // Header / toolbar — the same bar as Planner's, down to the classes: one
    // copy in internal/core/date-grid-header-slots, spread here so the four
    // slots stay part of ResourceTimeline's own slotClasses surface.
    ...dateGridHeaderSlots,

    // The scroll port. Everything that has to stay column-aligned lives inside
    // it, so the day header scrolls in lockstep with the lanes.
    track: ['w-full overflow-x-auto overscroll-x-contain', '[--rt-bar-inset:2px]'],

    // Day-axis header
    dayHeaderRow: [
      'grid grid-cols-[var(--rt-cols)] min-w-[var(--rt-min-w)]',
      'border-b border-border-subtle'
    ],
    corner: [
      'flex items-end bg-surface-base',
      'border-r border-border-subtle',
      'text-text-tertiary select-none'
    ],
    dayHeader: [
      'flex flex-col items-center justify-end gap-0.5',
      'border-r border-border-hairline last:border-r-0',
      'text-text-tertiary select-none'
    ],
    dayHeaderWeekday: 'uppercase tracking-wide',
    dayHeaderDate: 'tabular-nums font-medium',

    // Lanes
    body: 'flex flex-col',
    // Deliberately NOT on the column template: a group heading is one label
    // across the whole row, and placing it in the resource column would clip it
    // to `--rt-lane-w`. The row spans the full track width; the label is a
    // shrink-to-fit item that sticks to the left edge while the row scrolls.
    groupRow: 'flex items-center min-w-[var(--rt-min-w)] bg-surface-subtle',
    // `sticky left-0 z-20` is added in the markup, gated on
    // `stickyResourceColumn` — the resource column is the one thing that must
    // survive a horizontal scroll, and a consumer inside an already-scrolling
    // shell may want it off.
    groupLabel: ['bg-surface-subtle', 'font-semibold text-text-secondary select-none truncate'],
    lane: [
      'grid grid-cols-[var(--rt-cols)] min-w-[var(--rt-min-w)]',
      'border-b border-border-hairline last:border-b-0'
    ],
    laneHeader: [
      'flex flex-col justify-center bg-surface-base',
      'border-r border-border-subtle',
      'min-w-0'
    ],
    laneLabel: 'text-text-primary font-medium truncate',
    laneDescription: 'text-text-tertiary truncate',
    dayCell: [
      'relative border-r border-border-hairline last:border-r-0',
      'min-h-[calc(2*var(--rt-bar-top)_+_var(--rt-rows)*(var(--rt-bar-h)_+_var(--rt-bar-gap)))]',
      'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px]'
    ],

    // Bars. Absolutely positioned inside their START gridcell, so the ARIA row
    // keeps exactly one gridcell per day while the bar spans several columns.
    span: [
      'absolute z-10 flex items-center overflow-hidden',
      'left-[var(--rt-bar-inset)] h-[var(--rt-bar-h)]',
      'w-[calc(var(--rt-span)*100%_-_2*var(--rt-bar-inset))]',
      'top-[calc(var(--rt-bar-top)_+_var(--rt-row)*(var(--rt-bar-h)_+_var(--rt-bar-gap)))]',
      'text-text-on-fill select-none cursor-pointer',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    spanLabel: 'truncate',
    overflow: [
      'absolute right-1 bottom-0.5 z-10 rounded-full px-1',
      'bg-surface-elevated text-text-secondary tabular-nums select-none'
    ],

    // Legend + empty state
    legend: 'flex flex-wrap items-center',
    legendItem: 'flex items-center',
    legendDot: 'rounded-full shrink-0',
    legendLabel: 'text-text-secondary',
    empty: 'text-text-tertiary select-none text-center'
  },
  variants: {
    variant: {
      default: { base: '' },
      bordered: { base: 'border border-border-subtle rounded-xl p-3' },
      ghost: {
        dayHeaderRow: 'border-transparent',
        lane: 'border-transparent',
        dayCell: 'border-transparent',
        laneHeader: 'border-transparent',
        corner: 'border-transparent'
      }
    },
    size: {
      sm: {
        track: [
          '[--rt-lane-w:7rem]',
          '[--rt-day-w:2.25rem]',
          '[--rt-bar-h:1rem]',
          '[--rt-bar-gap:2px]',
          '[--rt-bar-top:3px]'
        ],
        ...dateGridHeaderSizes.sm,
        corner: 'px-2 py-1',
        dayHeader: 'px-0.5 py-1',
        dayHeaderWeekday: 'text-3xs',
        dayHeaderDate: 'text-xs',
        groupRow: 'py-0.5',
        groupLabel: 'px-2 text-xs',
        laneHeader: 'px-2 py-1 gap-0',
        laneLabel: 'text-xs',
        laneDescription: 'text-3xs',
        span: 'rounded-sm px-1 text-3xs',
        overflow: 'text-3xs',
        legend: 'gap-3 py-2',
        legendDot: 'size-2',
        legendItem: 'gap-1.5',
        legendLabel: 'text-xs',
        empty: 'py-6 text-xs'
      },
      md: {
        track: [
          '[--rt-lane-w:9rem]',
          '[--rt-day-w:2.75rem]',
          '[--rt-bar-h:1.25rem]',
          '[--rt-bar-gap:3px]',
          '[--rt-bar-top:4px]'
        ],
        ...dateGridHeaderSizes.md,
        corner: 'px-3 py-1.5',
        dayHeader: 'px-1 py-1.5',
        dayHeaderWeekday: 'text-2xs',
        dayHeaderDate: 'text-sm',
        groupRow: 'py-1',
        groupLabel: 'px-3 text-sm',
        laneHeader: 'px-3 py-1.5 gap-0.5',
        laneLabel: 'text-sm',
        laneDescription: 'text-2xs',
        span: 'rounded-md px-1.5 text-2xs',
        overflow: 'text-2xs',
        legend: 'gap-4 py-2.5',
        legendDot: 'size-2.5',
        legendItem: 'gap-2',
        legendLabel: 'text-sm',
        empty: 'py-8 text-sm'
      },
      lg: {
        track: [
          '[--rt-lane-w:11rem]',
          '[--rt-day-w:3.5rem]',
          '[--rt-bar-h:1.5rem]',
          '[--rt-bar-gap:4px]',
          '[--rt-bar-top:6px]'
        ],
        ...dateGridHeaderSizes.lg,
        corner: 'px-4 py-2',
        dayHeader: 'px-1.5 py-2',
        dayHeaderWeekday: 'text-xs',
        dayHeaderDate: 'text-base',
        groupRow: 'py-1.5',
        groupLabel: 'px-4 text-base',
        laneHeader: 'px-4 py-2 gap-0.5',
        laneLabel: 'text-base',
        laneDescription: 'text-xs',
        span: 'rounded-md px-2 text-xs',
        overflow: 'text-xs',
        legend: 'gap-5 py-3',
        legendDot: 'size-3',
        legendItem: 'gap-2',
        legendLabel: 'text-base',
        empty: 'py-10 text-base'
      }
    }
  },
  defaultVariants: {
    variant: 'default',
    size: 'md'
  }
});

export type ResourceTimelineVariants = VariantProps<typeof resourceTimelineVariants>;
/** Slot names derived from the tv() config — single source of truth for slotClasses. */
export type ResourceTimelineSlots = SlotNames<typeof resourceTimelineVariants>;
