import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const calendarVariants = tv({
  slots: {
    // Root
    base: 'w-full flex flex-col',

    // Header. `flex-wrap` is the overflow contract: nav + month title + view
    // switcher + today/next need ~543 px at `md` and nothing in the row could
    // wrap, so on a phone the header pushed the whole PAGE sideways — measured
    // on the docs site at a 390 px viewport, a 278 px calendar whose header
    // laid its children out to 507 px and a document 575 px wide. Wrapping
    // lets the switcher and the action buttons drop to their own line instead;
    // nothing is ever clipped, only re-flowed. CalendarHeader.svelte documents
    // where the line breaks fall.
    header: [
      'flex flex-wrap items-center justify-between gap-x-2 gap-y-2',
      'border-b border-border-hairline'
    ],
    // `tabular-nums` so the year does not re-measure the header on every step:
    // proportional digits give `2026` and `2031` different widths, and the
    // header drives the grid width, so the whole calendar twitched sideways
    // when paging across a year boundary.
    //
    // Named `title`, where Planner and ResourceTimeline call the same thing
    // `headerTitle`. Kept: it is a published `slotClasses` key of the most-used
    // component in this family, and renaming it would not make CalendarHeader a
    // `CoreDateGridHeader` caller anyway — that bar carries a month picker, a
    // view switcher and a narrow-viewport grid, and resolves its slots with a
    // second `extra` argument the core's resolver does not take (#191).
    title: 'font-semibold text-text-primary select-none tabular-nums',
    nav: 'flex items-center gap-1 shrink-0',
    // Rendered on the internal CoreIconButton (behaviour-only base: inline-flex
    // centring, cursor/select affordance, focus-visible reset, disabled
    // opacity/cursor/inertness), so this slot carries only the visual identity
    // on top — the classes the core already supplies (inline-flex items-center
    // justify-center, focus-visible:outline-none, disabled:opacity-50,
    // disabled:cursor-not-allowed) are not repeated here. Deliberate deltas vs.
    // the old `<Button unstyled mint="none">` render (which had NO plumbing):
    // `cursor-pointer` (was the UA arrow — Tailwind 4 preflight doesn't set it;
    // now consistent with every styled Button) and `disabled:pointer-events-none`
    // (a disabled nav button is fully inert: no more hover-bg feedback or
    // not-allowed cursor while disabled — matching the styled Button base).
    // The same classes as the shared toolbar's navButton
    // (internal/core/date-grid-header-slots.ts), kept separate for the reason
    // above: Calendar's header is its own component. See internal/core/.
    navButton: [
      'rounded-md',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2'
    ],

    // Grid
    grid: 'w-full',
    weekdayHeader: 'grid grid-cols-7',
    weekday: 'text-center font-medium text-text-tertiary select-none',
    weekRow: 'grid grid-cols-7',
    weekNumber:
      'text-text-quaternary text-center select-none tabular-nums italic border-r border-border-hairline',

    // Day cell
    day: [
      'relative flex flex-col items-center justify-start rounded-md',
      'cursor-pointer select-none',
      'transition-[color,background-color,box-shadow] duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
      'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent'
    ],
    dayNumber: 'font-medium text-text-primary tabular-nums leading-none',
    dotContainer: 'flex items-center justify-center gap-0.5',
    dot: 'rounded-full shrink-0',

    // Event list
    list: 'flex flex-col',
    dateHeader: 'font-semibold text-text-primary',
    empty: 'text-text-tertiary text-center py-4',

    // Event item
    item: [
      'flex items-start rounded-lg',
      'border border-border-hairline',
      'transition-[box-shadow,border-color] duration-[var(--blocks-duration-fast)]',
      'hover:shadow-[var(--blocks-shadow-sm)] hover:border-border-default'
    ],
    colorBar: 'shrink-0 rounded-full self-stretch',
    // Sits inline ahead of the title, not on a line of its own: the time costs
    // no row of its own in a timed agenda. It does cost width — `shrink-0`
    // keeps "09:05" from being squeezed into two lines, and `eventTitle` is a
    // flex item at the default `min-width: auto`, so it wraps rather than
    // truncates. In a narrow list (a `max-w-md` column) a long title can
    // therefore break one word earlier than it did before the time existed.
    // Tertiary + tabular-nums so the column of times reads as a rail beside the
    // titles rather than competing with them.
    eventTime: 'text-text-tertiary shrink-0 tabular-nums',
    eventTitle: 'font-semibold text-text-primary',
    eventDescription: 'text-text-secondary',
    eventHelper: 'text-text-tertiary',

    // Legend
    legend: 'flex flex-wrap items-center',
    legendItem: 'flex items-center',
    legendDot: 'rounded-full shrink-0',
    legendLabel: 'text-text-secondary',

    // Year view
    yearGrid: 'w-full',
    yearMonth: [
      'flex flex-col items-center rounded-lg',
      'cursor-pointer select-none',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1'
    ],
    yearMonthTitle: 'font-medium text-text-primary text-center',
    yearMiniDay: 'text-text-tertiary text-center tabular-nums leading-tight select-none',
    yearMiniDot: 'rounded-full mx-auto',

    // Week view
    weekGrid: ['grid grid-cols-7 w-full', 'border-t border-border-hairline'],
    weekColumn: ['flex flex-col', 'border-r border-border-hairline last:border-r-0'],
    weekColumnHeader: [
      'flex flex-col items-center cursor-pointer select-none',
      'border-b border-border-hairline',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1'
    ],
    weekColumnDayName: 'font-medium text-text-tertiary',
    weekColumnDayNumber: 'font-semibold tabular-nums text-text-primary',
    weekEventList: 'flex flex-col overflow-hidden',

    // Week all-day event (time grid mode)
    weekAllDayEvent: [
      'truncate rounded text-left',
      'cursor-pointer select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],

    // Multi-day bar
    multiDayBar: [
      'flex items-center text-text-on-fill text-xs px-1 truncate select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    multiDayBarContainer: 'grid w-full',

    // Day view
    dayView: 'flex flex-col',
    dayViewHeader: 'font-semibold text-text-primary',

    // Agenda view
    agendaView: 'flex flex-col',
    agendaDayGroup: 'flex flex-col',
    agendaDayHeader: [
      'font-semibold text-text-primary sticky top-0 bg-surface-base/95 backdrop-blur-sm z-10',
      'border-b border-border-hairline'
    ],
    agendaEventList: 'flex flex-col',

    // Time grid. One scroll port for both axes, and a single column system: the
    // track list lives HERE rather than in an inline style, so `unstyled` strips
    // it with everything else and `slotClasses.timeGrid` can replace it — the
    // month view's `grid-cols-7` rows work the same way. Only the day count is
    // inline (`--blocks-calendar-day-count`, set by CalendarTimeGrid), because
    // it is data, not a layout decision; custom properties substitute into
    // `repeat()` at computed-value time (measured: Chromium 141 and WebKit both
    // resolve `repeat(var(--n), …)` to seven 96 px tracks at `--n: 7`). Below
    // seven fitting columns the grid scrolls sideways rather than shrinking the
    // days to a stripe (#96). `relative` is load-bearing: the auto-scroll to the
    // current time reads the hour rows' `offsetTop` against this box.
    //
    // Border ownership: the grid owns its top edge alone — the layouts above it
    // (weekTimeLayout, the day view) draw none. The hairline token is
    // translucent, so two stacked 1px borders composite visibly darker instead
    // of merging (#210).
    timeGrid: [
      'relative grid overflow-auto',
      'grid-cols-[auto_repeat(var(--blocks-calendar-day-count,1),minmax(var(--blocks-calendar-day-min-width,6rem),1fr))]',
      'border-t border-border-hairline'
    ],
    // The three pinned cells. `bg-surface-base/95 backdrop-blur-sm` mirrors the
    // agenda's sticky day header — the calendar draws no surface of its own, so
    // a pinned cell has to bring one or the columns scroll through it. (On a
    // tinted ground, retint them through `slotClasses.timeGutter` /
    // `.timeHeadCell` / `.timeCorner`; the agenda header takes the same route.)
    //
    // Stacking, top down: corner (50) > gutter (40) > head strip (30) >
    // current-time line (10) > events (inline z-index = the overlap column,
    // capped at 9 in CalendarTimeEvent so a crowded day cannot climb out of the
    // grid). The line has to stay BELOW the strip — the day columns and the head
    // cells resolve in the same stacking context (`timeDayColumn` is `relative`
    // with `z-index: auto`, so it opens none), and the columns come later in the
    // tree, so an equal z-index would paint "now" over the weekday buttons the
    // moment the grid is scrolled past it. calendar.variants.test.ts asserts the
    // order numerically.
    //
    // `timeHeadCell` is one cell carrying BOTH the day head and the all-day band
    // (`flex flex-col`): a single `sticky top-0` then keeps the two on screen
    // together. Split across two grid rows the band would need a second sticky
    // offset — the head's measured height — and without one it scrolls away,
    // which the on-mount jump to the current time does immediately.
    timeGutter: ['sticky left-0 z-40 flex flex-col', 'bg-surface-base/95 backdrop-blur-sm'],
    // The head cell draws the strip's bottom edge (flush with `timeCorner`) and
    // continues the day columns' vertical line through the pinned strip — both
    // lines have exactly this one owner (#210).
    timeHeadCell: [
      'sticky top-0 z-30 flex flex-col',
      'bg-surface-base/95 backdrop-blur-sm',
      'border-b border-l border-border-hairline'
    ],
    timeCorner: [
      'sticky left-0 top-0 z-50',
      'bg-surface-base/95 backdrop-blur-sm',
      'border-b border-border-hairline'
    ],
    timeLabel: 'text-text-tertiary tabular-nums text-right select-none pr-2 leading-none',
    timeSlotRow: 'border-b border-border-hairline/50',
    timeDayColumn: ['relative', 'border-l border-border-hairline'],
    timeEvent: [
      'absolute rounded-md overflow-hidden',
      'text-text-on-fill px-1.5 py-0.5',
      'select-none',
      'transition-[box-shadow] duration-[var(--blocks-duration-fast)]',
      'hover:shadow-[var(--blocks-shadow-sm)] hover:brightness-110',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    // `grow` bites only inside the pinned head strip, where the band is the last
    // child of a flex column and has to fill down to the strip's edge rather
    // than stop under the tallest column's events. The band draws no border of
    // its own: the strip's bottom edge belongs to `timeHeadCell`, and in the
    // day view the grid's own `border-t` separates band and hours (#210). In
    // the day view the declaration is inert.
    allDayArea: ['grow'],
    // `live` is the dedicated "now" accent (red by convention, themes via
    // --color-live) — deliberately not `danger`, which signals errors. z-10 puts
    // it over every event (inline 1…n) and under the pinned strip (30…50).
    currentTimeLine: 'absolute left-0 right-0 z-10 pointer-events-none border-t-2 border-live',

    // Week time grid mode (replaces weekGrid when showTimeGrid). No top border
    // here — the grid inside owns that edge (#210).
    weekTimeLayout: ['w-full flex flex-col'],

    // Event popover
    eventPopover: 'flex flex-col overflow-y-auto',
    eventPopoverItem: [
      'flex items-center gap-2 rounded-md w-full text-left',
      'cursor-pointer',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover'
    ],

    // Mini calendar sidebar
    miniCalendar: ['shrink-0 flex flex-col', 'border-r border-border-hairline'],
    miniCalendarHeader: 'flex items-center justify-between',
    miniCalendarTitle: 'font-semibold text-text-primary text-center select-none',
    // Rendered on the internal CoreIconButton — same plumbing/slot split as
    // `navButton` above (and the same deliberate cursor-pointer delta); these
    // buttons are never disabled, so the disabled plumbing is inert.
    miniCalendarNavButton: [
      'rounded-md',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    miniCalendarWeekday: 'text-center text-text-tertiary select-none font-medium',
    miniCalendarDay: [
      'relative flex items-center justify-center rounded-md',
      'cursor-pointer select-none tabular-nums',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'hover:bg-surface-hover',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ]
  },

  variants: {
    variant: {
      default: {},
      bordered: {
        base: 'border border-border-hairline rounded-lg overflow-clip',
        weekRow: 'border-b border-border-hairline/50 last:border-b-0',
        item: 'border-border-default',
        weekColumn: 'border-r border-border-hairline'
      },
      ghost: {
        base: 'bg-transparent',
        header: 'border-b-0 bg-transparent',
        navButton: 'hover:bg-transparent hover:text-primary-text',
        weekday: 'text-text-quaternary font-normal',
        day: 'hover:bg-transparent hover:text-primary-text',
        weekGrid: 'border-t-0',
        weekColumn: 'border-r-0',
        weekColumnHeader: 'border-b-0',
        // Ghost drops the whole pinned-strip frame: the grid's top edge, and
        // the strip's bottom/vertical lines on head cell and corner — the
        // corner carries the head row's bottom line across the gutter, so it
        // drops it with the heads rather than leaving a stub over the labels.
        timeGrid: 'border-t-0',
        timeHeadCell: 'border-b-0 border-l-0',
        timeCorner: 'border-b-0',
        item: 'border-transparent shadow-none hover:shadow-none',
        multiDayBar: 'opacity-90'
      }
    },

    // `--blocks-calendar-day-min-width` rides on the ROOT, not on the grid: a
    // declaration on the grid itself would win over anything a consumer sets
    // further up, and the root is the element their `style` prop lands on. Below
    // seven of these the week view scrolls (CalendarTimeGrid builds the tracks).
    size: {
      sm: {
        base: 'gap-1 [--blocks-calendar-day-min-width:5rem]',
        header: 'px-2 py-1.5',
        title: 'text-sm',
        navButton: 'size-7 rounded-md',
        weekday: 'text-xs py-1',
        day: 'h-8 py-0.5',
        dayNumber: 'text-xs',
        dot: 'size-1',
        dotContainer: 'mt-0.5 gap-px',
        list: 'gap-1.5 mt-3',
        dateHeader: 'text-sm mb-1.5',
        item: 'p-2 gap-2',
        colorBar: 'w-0.5',
        eventTime: 'text-2xs',
        eventTitle: 'text-sm',
        eventDescription: 'text-xs',
        eventHelper: 'text-xs',
        legend: 'gap-3 py-2 px-2',
        legendDot: 'size-2',
        legendItem: 'gap-1.5',
        legendLabel: 'text-xs',
        yearGrid: 'gap-1 p-1',
        yearMonth: 'p-1 gap-0.5',
        yearMonthTitle: 'text-xs mb-0.5',
        yearMiniDay: 'text-3xs size-3',
        yearMiniDot: 'size-0.5',
        weekGrid: 'gap-px',
        weekColumn: 'min-h-16',
        weekColumnHeader: 'py-1 px-0.5 gap-0',
        weekColumnDayName: 'text-2xs',
        weekColumnDayNumber: 'text-base',
        weekEventList: 'gap-0.5 p-0.5',
        weekAllDayEvent: 'text-2xs px-0.5',
        multiDayBar: 'text-2xs',
        dayView: 'gap-2 mt-2',
        dayViewHeader: 'text-sm mb-1',
        agendaView: 'gap-2 mt-2',
        agendaDayGroup: 'gap-1',
        agendaDayHeader: 'text-xs py-1 px-2',
        agendaEventList: 'gap-1',
        // `scroll-pl-*` matches the hour gutter's width (the `timeLabel` box
        // below): arrow-keying back to the first day scrolls it into view, and
        // without the padding the browser's minimal alignment parks the head
        // under the pinned gutter. Deterministic instead of engine-dependent.
        timeGrid: 'max-h-[360px] scroll-pl-8',
        timeLabel: 'text-2xs w-8',
        timeEvent: 'text-2xs px-1 py-px',
        allDayArea: 'py-0.5 px-0.5',
        eventPopover: 'gap-0.5 max-h-32',
        eventPopoverItem: 'px-1.5 py-1 text-xs',
        miniCalendar: 'w-44 p-1.5 gap-1 hidden',
        miniCalendarHeader: 'px-1 py-0.5',
        miniCalendarTitle: 'text-xs',
        miniCalendarNavButton: 'size-5 text-xs',
        miniCalendarWeekday: 'text-2xs py-0.5',
        miniCalendarDay: 'size-5 text-2xs'
      },
      md: {
        base: 'gap-2 [--blocks-calendar-day-min-width:6rem]',
        header: 'px-3 py-2.5',
        title: 'text-base',
        navButton: 'size-8 rounded-md',
        weekday: 'text-sm py-1.5',
        day: 'h-12 py-1',
        dayNumber: 'text-sm',
        dot: 'size-1.5',
        dotContainer: 'mt-1 gap-0.5',
        list: 'gap-2 mt-4',
        dateHeader: 'text-base mb-2',
        item: 'p-3 gap-3',
        colorBar: 'w-1',
        eventTime: 'text-xs',
        eventTitle: 'text-base',
        eventDescription: 'text-sm',
        eventHelper: 'text-sm',
        legend: 'gap-4 py-2.5 px-3',
        legendDot: 'size-2.5',
        legendItem: 'gap-2',
        legendLabel: 'text-sm',
        yearGrid: 'gap-2 p-2',
        yearMonth: 'p-2 gap-1',
        yearMonthTitle: 'text-sm mb-1',
        yearMiniDay: 'text-3xs size-4',
        yearMiniDot: 'size-1',
        weekGrid: 'gap-px',
        weekColumn: 'min-h-24',
        weekColumnHeader: 'py-1.5 px-1 gap-0.5',
        weekColumnDayName: 'text-xs',
        weekColumnDayNumber: 'text-lg',
        weekEventList: 'gap-1 p-1',
        weekAllDayEvent: 'text-xs px-1',
        multiDayBar: 'text-xs',
        dayView: 'gap-3 mt-3',
        dayViewHeader: 'text-base mb-1.5',
        agendaView: 'gap-3 mt-3',
        agendaDayGroup: 'gap-1.5',
        agendaDayHeader: 'text-sm py-1.5 px-3',
        agendaEventList: 'gap-1.5',
        timeGrid: 'max-h-[480px] scroll-pl-10',
        timeLabel: 'text-xs w-10',
        timeEvent: 'text-xs px-1.5 py-0.5',
        allDayArea: 'py-1 px-1',
        eventPopover: 'gap-1 max-h-48',
        eventPopoverItem: 'px-2 py-1.5 text-sm',
        miniCalendar: 'w-52 p-2 gap-1.5',
        miniCalendarHeader: 'px-1.5 py-1',
        miniCalendarTitle: 'text-sm',
        miniCalendarNavButton: 'size-6 text-sm',
        miniCalendarWeekday: 'text-xs py-0.5',
        miniCalendarDay: 'size-6 text-xs'
      },
      lg: {
        base: 'gap-3 [--blocks-calendar-day-min-width:7rem]',
        header: 'px-4 py-3',
        title: 'text-lg',
        navButton: 'size-10 rounded-lg',
        weekday: 'text-base py-2',
        day: 'h-16 py-1.5',
        dayNumber: 'text-base',
        dot: 'size-2',
        dotContainer: 'mt-1.5 gap-0.5',
        list: 'gap-3 mt-5',
        dateHeader: 'text-lg mb-2.5',
        item: 'p-4 gap-3',
        colorBar: 'w-1',
        eventTime: 'text-sm',
        eventTitle: 'text-lg',
        eventDescription: 'text-base',
        eventHelper: 'text-sm',
        legend: 'gap-5 py-3 px-4',
        legendDot: 'size-3',
        legendItem: 'gap-2.5',
        legendLabel: 'text-base',
        yearGrid: 'gap-3 p-3',
        yearMonth: 'p-3 gap-1.5',
        yearMonthTitle: 'text-base mb-1.5',
        yearMiniDay: 'text-xs size-5',
        yearMiniDot: 'size-1.5',
        weekGrid: 'gap-px',
        weekColumn: 'min-h-32',
        weekColumnHeader: 'py-2 px-1.5 gap-0.5',
        weekColumnDayName: 'text-sm',
        weekColumnDayNumber: 'text-xl',
        weekEventList: 'gap-1.5 p-1.5',
        weekAllDayEvent: 'text-sm px-1.5',
        multiDayBar: 'text-sm',
        dayView: 'gap-4 mt-4',
        dayViewHeader: 'text-lg mb-2',
        agendaView: 'gap-4 mt-4',
        agendaDayGroup: 'gap-2',
        agendaDayHeader: 'text-base py-2 px-4',
        agendaEventList: 'gap-2',
        timeGrid: 'max-h-[600px] scroll-pl-12',
        timeLabel: 'text-sm w-12',
        timeEvent: 'text-sm px-2 py-1',
        allDayArea: 'py-1.5 px-1.5',
        eventPopover: 'gap-1.5 max-h-64',
        eventPopoverItem: 'px-2.5 py-2 text-base',
        miniCalendar: 'w-60 p-3 gap-2',
        miniCalendarHeader: 'px-2 py-1.5',
        miniCalendarTitle: 'text-base',
        miniCalendarNavButton: 'size-7 text-base',
        miniCalendarWeekday: 'text-sm py-1',
        miniCalendarDay: 'size-7 text-sm'
      }
    },

    // Day-level state variants (applied per-cell at render time)
    dayState: {
      default: {},
      today: {
        day: 'bg-primary',
        dayNumber: 'text-text-on-primary font-bold'
      },
      selected: {
        day: 'bg-primary-subtle ring-1 ring-primary',
        dayNumber: 'text-primary-text font-bold'
      },
      todaySelected: {
        day: 'bg-primary ring-2 ring-primary ring-offset-1',
        dayNumber: 'text-text-on-primary font-bold'
      },
      rangeStart: {
        day: 'bg-primary rounded-r-none',
        dayNumber: 'text-text-on-primary font-bold'
      },
      rangeEnd: {
        day: 'bg-primary rounded-l-none',
        dayNumber: 'text-text-on-primary font-bold'
      },
      inRange: {
        day: 'bg-primary-subtle/50 rounded-none',
        dayNumber: 'text-primary-text'
      },
      previewRange: {
        day: 'bg-primary-subtle/30 rounded-none',
        dayNumber: 'text-primary-text/70'
      },
      previewRangeEnd: {
        day: 'bg-primary-subtle/50 ring-1 ring-primary/30 rounded-md',
        dayNumber: 'text-primary-text font-medium'
      },
      outsideMonth: {
        day: 'cursor-pointer hover:bg-surface-hover/50',
        dayNumber: 'text-text-quaternary font-normal'
      },
      disabled: {
        day: 'opacity-40 cursor-not-allowed hover:bg-transparent',
        dayNumber: 'text-text-disabled'
      }
    },

    hasEvents: {
      true: {
        dayNumber: 'font-bold'
      },
      false: {}
    }
  },

  compoundVariants: [
    {
      dayState: 'today' as const,
      class: {
        dot: 'bg-surface-base/80'
      }
    }
  ],

  defaultVariants: {
    variant: 'default',
    size: 'md',
    dayState: 'default',
    hasEvents: false
  }
});

export type CalendarVariants = VariantProps<typeof calendarVariants>;
export type CalendarSlots = SlotNames<typeof calendarVariants>;
