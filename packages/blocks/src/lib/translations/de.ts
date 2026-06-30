export default {
  accessibility: {
    avatar: 'Avatar',
    clearInput: 'Eingabe löschen',
    clearSearch: 'Suche löschen',
    clearSelection: 'Auswahl löschen',
    closeDialog: 'Dialog schließen',
    closeDrawer: 'Seitenleiste schließen',
    dismiss: 'Schließen',
    fileUpload: 'Datei-Upload',
    loading: 'Wird geladen',
    maximum: 'Maximum',
    minimum: 'Minimum',
    pagination: 'Seitennavigation',
    progress: 'Fortschritt',
    slider: 'Schieberegler',
    toggle: 'Umschalter',
    toggleOptions: 'Optionen umschalten',
    removableBadge: 'Entfernbarer Badge',
    removeBadge: 'Badge entfernen',
    removeFile: '{{name}} entfernen'
  },
  button: {
    close: 'Schließen',
    apply: 'Anwenden',
    cancel: 'Abbrechen',
    confirm: 'Bestätigen'
  },
  menu: {
    placeholder: 'Option auswählen...'
  },
  common: {
    loading: 'Wird geladen...'
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
    ariaLabel: 'Sprachauswahl',
    placeholder: 'Sprache wählen...'
  },
  pagination: {
    next: 'Nächste',
    first: 'Erste',
    last: 'Letzte',
    page: 'Seite',
    previous: 'Vorherige'
  },
  calendar: {
    recurring: 'Wiederkehrender Termin',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    previousDay: 'Vorheriger Tag',
    nextDay: 'Nächster Tag',
    previousYear: 'Vorheriges Jahr',
    nextYear: 'Nächstes Jahr',
    today: 'Heute',
    calendarGrid: 'Kalender',
    weekdays: 'Wochentage',
    weekNumber: 'KW',
    events: 'Termine',
    noEvents: 'Keine Termine',
    showMore: '{{count}} weitere anzeigen',
    legend: 'Legende',
    yearView: 'Jahresübersicht',
    weekView: 'Wochenansicht',
    dayView: 'Tagesansicht',
    monthView: 'Monatsansicht',
    viewMonth: 'Monat',
    viewYear: 'Jahr',
    viewWeek: 'Woche',
    viewDay: 'Tag',
    multiDayLabel: 'Tag {{current}} von {{total}}',
    agendaView: 'Listenansicht',
    viewAgenda: 'Liste',
    viewSwitcher: 'Ansichtsmodus'
  },
  planner: {
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    previousRange: 'Vorheriger Zeitraum',
    nextRange: 'Nächster Zeitraum',
    today: 'Heute',
    grid: 'Planer',
    weekNumber: 'Kalenderwoche',
    itemCount: '{{count}} Einträge'
  },
  commandPalette: {
    noResults: 'Keine Ergebnisse gefunden.',
    search: 'Suchen...',
    hints: {
      navigate: 'Navigieren',
      select: 'Auswählen',
      close: 'Schließen'
    }
  },
  compositionBar: {
    total: 'Gesamt',
    summary: 'Komposition: {{total}} ({{count}} Anteile) — {{parts}}',
    share: 'Anteil',
    value: 'Wert',
    percent: 'Prozent',
    remaining: 'verbleibend'
  },
  guide: {
    next: 'Weiter',
    previous: 'Zurück',
    skip: 'Tour überspringen',
    done: 'Fertig',
    step: 'Schritt {{current}} von {{total}}',
    tour: 'Geführte Tour',
    close: 'Schließen',
    openHelp: 'Hilfe',
    backToList: 'Alle Themen',
    info: 'Mehr Informationen',
    infoAbout: 'Mehr Informationen zu {{label}}',
    dismiss: 'Hinweis ausblenden',
    startTour: 'Geführte Tour starten',
    actionRequired: 'Führe die markierte Aktion aus, um fortzufahren',
    filterPlaceholder: 'Themen filtern…',
    noResults: 'Keine passenden Themen'
  },
  datepicker: {
    placeholder: 'Datum wählen...',
    rangePlaceholder: 'Zeitraum wählen...',
    clear: 'Auswahl löschen',
    openCalendar: 'Kalender öffnen',
    invalidDate: 'Ungültiges Datum',
    outOfRange: 'Datum liegt außerhalb des zulässigen Bereichs',
    invalidRange: 'Ungültiger Zeitraum'
  },
  fileUpload: {
    exists: 'Datei bereits hinzugefügt',
    invalidType: 'Dateityp {{type}} ist nicht erlaubt',
    tooLarge: 'Datei überschreitet das Limit von {{size}}',
    tooMany: 'Maximal {{count}} Dateien erlaubt',
    tooSmall: 'Datei muss mindestens {{size}} groß sein'
  },
  sankey: {
    summary: 'Sankey-Diagramm: {{nodes}} Knoten, {{links}} Verbindungen — {{flows}}',
    source: 'Quelle',
    target: 'Ziel',
    value: 'Wert'
  },
  slider: {
    rangeStatus: {
      insideRecommended: 'Im empfohlenen Bereich',
      insideValid: 'Im erlaubten Bereich',
      insideValidOnly: 'Außerhalb der Empfehlung, aber zulässig',
      outsideValid: 'Außerhalb des erlaubten Bereichs'
    }
  },
  themeSwitcher: {
    lightMode: 'Heller Modus',
    darkMode: 'Dunkler Modus',
    systemTheme: 'Systemdesign'
  },
  time: {
    ago: 'vor {{value}} {{unit}}',
    now: 'jetzt'
  }
} as const;
