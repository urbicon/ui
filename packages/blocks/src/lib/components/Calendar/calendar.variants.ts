import { type SlotNames, tv, type VariantProps } from '$lib/utils/variants';

export const calendarVariants = tv({
  slots: {
    // Root
    base: 'w-full flex flex-col',

    // Header
    header: ['flex items-center justify-between', 'border-b border-border-hairline'],
    title: 'font-semibold text-text-primary select-none',
    nav: 'flex items-center gap-1',
    navButton: [
      'inline-flex items-center justify-center rounded-md',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2',
      'disabled:opacity-50 disabled:cursor-not-allowed'
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
      'flex items-center text-text-on-primary text-xs px-1 truncate select-none',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    multiDayBarContainer: 'grid w-full',

    // Day view
    dayView: 'flex flex-col',
    dayViewHeader: 'font-semibold text-text-primary',
    dayEventList: 'flex flex-col',

    // Agenda view
    agendaView: 'flex flex-col',
    agendaDayGroup: 'flex flex-col',
    agendaDayHeader: [
      'font-semibold text-text-primary sticky top-0 bg-surface-base/95 backdrop-blur-sm z-10',
      'border-b border-border-hairline'
    ],
    agendaEventList: 'flex flex-col',

    // Time grid
    timeGrid: ['overflow-y-auto overflow-x-hidden', 'border-t border-border-hairline'],
    timeLabel: 'text-text-tertiary tabular-nums text-right select-none pr-2 leading-none',
    timeSlotRow: 'border-b border-border-hairline/50',
    timeDayColumn: ['relative flex-1', 'border-l border-border-hairline'],
    timeEvent: [
      'absolute rounded-md overflow-hidden',
      'text-text-on-primary px-1.5 py-0.5',
      'select-none',
      'transition-[box-shadow] duration-[var(--blocks-duration-fast)]',
      'hover:shadow-[var(--blocks-shadow-sm)] hover:brightness-110',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
    ],
    allDayArea: ['border-b border-border-hairline'],
    currentTimeLine: 'absolute left-0 right-0 z-10 pointer-events-none border-t-2 border-red-500',

    // Week time grid mode (replaces weekGrid when showTimeGrid)
    weekTimeLayout: ['w-full flex flex-col', 'border-t border-border-hairline'],

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
    miniCalendarNavButton: [
      'inline-flex items-center justify-center rounded-md',
      'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      'transition-colors duration-[var(--blocks-duration-fast)]',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50'
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
        navButton: 'hover:bg-transparent hover:text-primary',
        weekday: 'text-text-quaternary font-normal',
        day: 'hover:bg-transparent hover:text-primary',
        weekGrid: 'border-t-0',
        weekColumn: 'border-r-0',
        weekColumnHeader: 'border-b-0',
        item: 'border-transparent shadow-none hover:shadow-none',
        multiDayBar: 'opacity-90'
      }
    },

    size: {
      sm: {
        base: 'gap-1',
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
        yearMiniDay: 'text-[9px] size-3',
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
        dayEventList: 'gap-1.5',
        agendaView: 'gap-2 mt-2',
        agendaDayGroup: 'gap-1',
        agendaDayHeader: 'text-xs py-1 px-2',
        agendaEventList: 'gap-1',
        timeGrid: 'max-h-[360px]',
        timeLabel: 'text-2xs w-8',
        timeEvent: 'text-2xs px-1 py-px',
        allDayArea: 'py-0.5 px-0.5 gap-px',
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
        base: 'gap-2',
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
        yearMiniDay: 'text-[10px] size-4',
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
        dayEventList: 'gap-2',
        agendaView: 'gap-3 mt-3',
        agendaDayGroup: 'gap-1.5',
        agendaDayHeader: 'text-sm py-1.5 px-3',
        agendaEventList: 'gap-1.5',
        timeGrid: 'max-h-[480px]',
        timeLabel: 'text-xs w-10',
        timeEvent: 'text-xs px-1.5 py-0.5',
        allDayArea: 'py-1 px-1 gap-0.5',
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
        base: 'gap-3',
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
        dayEventList: 'gap-3',
        agendaView: 'gap-4 mt-4',
        agendaDayGroup: 'gap-2',
        agendaDayHeader: 'text-base py-2 px-4',
        agendaEventList: 'gap-2',
        timeGrid: 'max-h-[600px]',
        timeLabel: 'text-sm w-12',
        timeEvent: 'text-sm px-2 py-1',
        allDayArea: 'py-1.5 px-1.5 gap-1',
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
        dayNumber: 'text-primary font-bold'
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
        dayNumber: 'text-primary'
      },
      previewRange: {
        day: 'bg-primary-subtle/30 rounded-none',
        dayNumber: 'text-primary/70'
      },
      previewRangeEnd: {
        day: 'bg-primary-subtle/50 ring-1 ring-primary/30 rounded-md',
        dayNumber: 'text-primary font-medium'
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
