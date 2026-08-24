export default {
  accessibility: {
    avatar: 'Avatar',
    avatarGroup: 'Benutzer-Avatare',
    breadcrumb: 'Pfadnavigation',
    breadcrumbExpand: 'Alle Pfadebenen anzeigen',
    clearInput: 'Eingabe löschen',
    clearSearch: 'Suche löschen',
    clearSelection: 'Auswahl löschen',
    closeDialog: 'Dialog schließen',
    // Ein Drawer fährt je nach `placement` von jeder Kante ein — auch von unten
    // (das Werkzeug-Sheet der Tabelle). Das Wort darf deshalb keine Seite
    // benennen: „Seitenleiste“ sagte Screenreader-Nutzern die falsche Richtung.
    closeDrawer: 'Einblendung schließen',
    copied: 'Kopiert',
    copy: 'Kopieren',
    copyFailed: 'Kopieren fehlgeschlagen',
    dismiss: 'Schließen',
    fileUpload: 'Datei-Upload',
    loading: 'Wird geladen',
    maximum: 'Maximum',
    minimum: 'Minimum',
    pagination: 'Seitennavigation',
    pinInputCell: 'Zeichen {{index}} von {{total}}',
    progress: 'Fortschritt',
    qrCode: 'QR-Code',
    slider: 'Schieberegler',
    timeHours: 'Stunden',
    timeMinutes: 'Minuten',
    timeSeconds: 'Sekunden',
    timeMeridiem: 'AM oder PM',
    toggle: 'Umschalter',
    toggleOptions: 'Optionen umschalten',
    removeBadge: 'Badge entfernen',
    removeFile: '{{name}} entfernen',
    removeTag: '{{label}} entfernen'
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
    previous: 'Vorherige',
    pageInfo: '{{label}} {{current}} von {{total}}',
    rangeInfo: '{{start}}–{{end}} von {{total}}'
  },
  scroller: {
    previous: 'Zurück',
    next: 'Weiter',
    item: 'Element {{index}} von {{total}}',
    items: 'Elemente {{from}}–{{to}} von {{total}}'
  },
  calendar: {
    recurring: 'Wiederkehrender Termin',
    previousMonth: 'Vorheriger Monat',
    nextMonth: 'Nächster Monat',
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    previousDay: 'Vorheriger Tag',
    nextDay: 'Nächster Tag',
    previousRange: 'Vorheriger Zeitraum',
    nextRange: 'Nächster Zeitraum',
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
    viewMonth: 'Monat',
    viewYear: 'Jahr',
    viewWeek: 'Woche',
    viewDay: 'Tag',
    multiDayLabel: 'Tag {{current}} von {{total}}',
    // Zeitzeile am LETZTEN Tag eines mehrtägigen Termins mit Uhrzeit: nur das
    // Ende gilt für diesen Tag, und nackt gesetzt läse es sich als Startzeit.
    untilTime: 'bis {{time}}',
    agendaView: 'Listenansicht',
    viewAgenda: 'Liste',
    viewSwitcher: 'Ansichtsmodus',
    // Kurzform der Ansichts-Labels — im Umschalter, sobald der Platz knapp ist
    // (`size="sm"` oder Viewport unter `sm`). Der zugängliche Name der Buttons
    // bleibt das volle Label, die Kurzform ist rein visuell.
    viewMonthShort: 'M',
    viewYearShort: 'J',
    viewWeekShort: 'W',
    viewDayShort: 'T',
    viewAgendaShort: 'L'
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
    itemCount: '{{count}} Einträge'
  },
  resourceTimeline: {
    previousWeek: 'Vorherige Woche',
    nextWeek: 'Nächste Woche',
    previousRange: 'Vorheriger Zeitraum',
    nextRange: 'Nächster Zeitraum',
    today: 'Heute',
    grid: 'Ressourcen-Timeline',
    occupied: 'Belegt',
    moreItems: '{{count}} weitere',
    noResources: 'Keine Ressourcen'
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
  avatar: {
    status: {
      online: 'Online',
      offline: 'Offline',
      away: 'Abwesend',
      busy: 'Beschäftigt'
    }
  },
  journeyTimeline: {
    label: 'Verlauf',
    status: {
      complete: 'Abgeschlossen',
      active: 'In Bearbeitung',
      pending: 'Ausstehend',
      attention: 'Aufmerksamkeit erforderlich',
      blocked: 'Blockiert',
      skipped: 'Übersprungen'
    }
  },
  datepicker: {
    placeholder: 'Datum wählen...',
    rangePlaceholder: 'Zeitraum wählen...',
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
  chart: {
    category: 'Kategorie',
    series: 'Datenreihe {{index}}',
    segment: 'Segment',
    value: 'Wert',
    share: 'Anteil'
  },
  stepper: {
    optional: 'Optional'
  }
} as const;
