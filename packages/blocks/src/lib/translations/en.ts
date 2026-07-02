export default {
  accessibility: {
    avatar: 'Avatar',
    clearInput: 'Clear input',
    clearSearch: 'Clear search',
    clearSelection: 'Clear selection',
    closeDialog: 'Close dialog',
    closeDrawer: 'Close drawer',
    dismiss: 'Dismiss',
    fileUpload: 'File upload',
    loading: 'Loading',
    maximum: 'Maximum',
    minimum: 'Minimum',
    pagination: 'Page navigation',
    progress: 'Progress',
    slider: 'Slider',
    toggle: 'Toggle',
    toggleOptions: 'Toggle options',
    removableBadge: 'Removable badge',
    removeBadge: 'Remove badge',
    removeFile: 'Remove {{name}}'
  },
  button: {
    close: 'Close',
    apply: 'Apply',
    cancel: 'Cancel',
    confirm: 'Confirm'
  },
  menu: {
    placeholder: 'Select an option...'
  },
  common: {
    loading: 'Loading...'
  },
  languages: {
    de: 'Deutsch',
    en: 'English',
    es: 'Español',
    fr: 'Français',
    it: 'Italiano',
    nl: 'Nederlands'
  },
  localeSwitcher: {
    ariaLabel: 'Language selection',
    placeholder: 'Select language...'
  },
  pagination: {
    next: 'Next',
    first: 'First',
    last: 'Last',
    page: 'Page',
    previous: 'Previous'
  },
  calendar: {
    recurring: 'Recurring event',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    previousYear: 'Previous year',
    nextYear: 'Next year',
    today: 'Today',
    calendarGrid: 'Calendar',
    weekdays: 'Weekdays',
    weekNumber: 'Week number',
    events: 'Events',
    noEvents: 'No events',
    showMore: '{{count}} more',
    legend: 'Legend',
    yearView: 'Year overview',
    weekView: 'Week view',
    dayView: 'Day view',
    monthView: 'Month view',
    viewMonth: 'Month',
    viewYear: 'Year',
    viewWeek: 'Week',
    viewDay: 'Day',
    multiDayLabel: 'Day {{current}} of {{total}}',
    agendaView: 'Agenda view',
    viewAgenda: 'Agenda',
    viewSwitcher: 'View mode'
  },
  planner: {
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousRange: 'Previous range',
    nextRange: 'Next range',
    today: 'Today',
    grid: 'Planner',
    weekNumber: 'Week number',
    itemCount: '{{count}} items'
  },
  commandPalette: {
    noResults: 'No results found.',
    search: 'Search...',
    hints: {
      navigate: 'Navigate',
      select: 'Select',
      close: 'Close'
    }
  },
  compositionBar: {
    total: 'Total',
    summary: 'Composition: {{total}} ({{count}} shares) — {{parts}}',
    share: 'Share',
    value: 'Value',
    percent: 'Percent',
    remaining: 'remaining'
  },
  guide: {
    next: 'Next',
    previous: 'Back',
    skip: 'Skip tour',
    done: 'Done',
    step: 'Step {{current}} of {{total}}',
    tour: 'Guided tour',
    close: 'Close',
    openHelp: 'Help',
    backToList: 'All topics',
    info: 'More information',
    infoAbout: 'More information about {{label}}',
    dismiss: 'Dismiss hint',
    startTour: 'Start the guided tour',
    actionRequired: 'Complete the highlighted action to continue',
    filterPlaceholder: 'Filter topics…',
    noResults: 'No matching topics'
  },
  journeyTimeline: {
    label: 'Journey',
    status: {
      complete: 'Completed',
      active: 'In progress',
      pending: 'Pending',
      attention: 'Needs attention',
      blocked: 'Blocked',
      skipped: 'Skipped'
    }
  },
  datepicker: {
    placeholder: 'Select a date...',
    rangePlaceholder: 'Select a date range...',
    clear: 'Clear selection',
    openCalendar: 'Open calendar',
    invalidDate: 'Invalid date',
    outOfRange: 'Date is outside the allowed range',
    invalidRange: 'Invalid date range'
  },
  fileUpload: {
    exists: 'File already added',
    invalidType: 'File type {{type}} is not allowed',
    tooLarge: 'File exceeds {{size}} limit',
    tooMany: 'Maximum {{count}} files allowed',
    tooSmall: 'File must be at least {{size}}'
  },
  sankey: {
    summary: 'Sankey diagram: {{nodes}} nodes, {{links}} links — {{flows}}',
    source: 'Source',
    target: 'Target',
    value: 'Value'
  },
  slider: {
    rangeStatus: {
      insideRecommended: 'In recommended range',
      insideValid: 'In valid range',
      insideValidOnly: 'Outside recommended range, but valid',
      outsideValid: 'Outside valid range'
    }
  },
  themeSwitcher: {
    lightMode: 'Light mode',
    darkMode: 'Dark mode',
    systemTheme: 'System theme'
  },
  time: {
    ago: '{{value}} {{unit}} ago',
    now: 'now'
  }
} as const;
