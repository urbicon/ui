export default {
  accessibility: {
    avatar: 'Avatar',
    avatarGroup: 'User avatars',
    breadcrumb: 'Breadcrumb',
    breadcrumbExpand: 'Show all breadcrumb items',
    clearInput: 'Clear input',
    clearSearch: 'Clear search',
    clearSelection: 'Clear selection',
    closeDialog: 'Close dialog',
    closeDrawer: 'Close drawer',
    copied: 'Copied',
    copy: 'Copy',
    copyFailed: 'Copy failed',
    dismiss: 'Dismiss',
    fileUpload: 'File upload',
    loading: 'Loading',
    maximum: 'Maximum',
    minimum: 'Minimum',
    pagination: 'Page navigation',
    pinInputCell: 'Character {{index}} of {{total}}',
    progress: 'Progress',
    qrCode: 'QR code',
    slider: 'Slider',
    timeHours: 'Hours',
    timeMinutes: 'Minutes',
    timeSeconds: 'Seconds',
    timeMeridiem: 'AM or PM',
    toggle: 'Toggle',
    toggleOptions: 'Toggle options',
    removeBadge: 'Remove badge',
    removeFile: 'Remove {{name}}',
    removeTag: 'Remove {{label}}'
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
    previous: 'Previous',
    pageInfo: '{{label}} {{current}} of {{total}}',
    rangeInfo: '{{start}}–{{end}} of {{total}}'
  },
  scroller: {
    previous: 'Previous',
    next: 'Next',
    item: 'Item {{index}} of {{total}}',
    items: 'Items {{from}}–{{to}} of {{total}}'
  },
  calendar: {
    recurring: 'Recurring event',
    previousMonth: 'Previous month',
    nextMonth: 'Next month',
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    previousDay: 'Previous day',
    nextDay: 'Next day',
    // The agenda's arrows step its whole window, so they name a range rather
    // than a month (a one-day agenda uses previousDay/nextDay instead).
    previousRange: 'Previous range',
    nextRange: 'Next range',
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
    viewMonth: 'Month',
    viewYear: 'Year',
    viewWeek: 'Week',
    viewDay: 'Day',
    multiDayLabel: 'Day {{current}} of {{total}}',
    // The clock line on the LAST day of a multi-day timed event. Only the end
    // is a true statement about that day, and set bare it would read as a start.
    untilTime: 'until {{time}}',
    agendaView: 'Agenda view',
    viewAgenda: 'Agenda',
    viewSwitcher: 'View mode',
    // Condensed view labels — shown in the header's view switcher when space
    // is short (`size="sm"`, or any viewport below `sm`). The full label stays
    // the button's accessible name, so these are visual only.
    viewMonthShort: 'M',
    viewYearShort: 'Y',
    viewWeekShort: 'W',
    viewDayShort: 'D',
    viewAgendaShort: 'A'
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
    itemCount: '{{count}} items'
  },
  resourceTimeline: {
    previousWeek: 'Previous week',
    nextWeek: 'Next week',
    previousRange: 'Previous range',
    nextRange: 'Next range',
    today: 'Today',
    grid: 'Resource timeline',
    occupied: 'Occupied',
    moreItems: '{{count}} more',
    noResources: 'No resources'
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
  avatar: {
    status: {
      online: 'Online',
      offline: 'Offline',
      away: 'Away',
      busy: 'Busy'
    }
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
  chart: {
    category: 'Category',
    series: 'Series {{index}}',
    segment: 'Segment',
    value: 'Value',
    share: 'Share'
  },
  stepper: {
    optional: 'Optional'
  }
} as const;
