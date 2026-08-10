export default {
  button: {
    close: 'Schließen'
  },
  data: {
    empty: 'Keine Daten verfügbar',
    loading: 'Daten werden geladen...',
    refresh: 'Aktualisieren'
  },
  filter: {
    button: {
      add: 'Filter hinzufügen',
      remove: 'Filter entfernen',
      clearAll: 'Alle löschen'
    },
    input: {
      enterValue: 'Wert eingeben...'
    },
    menu: {
      addFilter: 'Filter hinzufügen'
    },
    operators: {
      after: 'nach',
      before: 'vor',
      contains: 'enthält',
      endsWith: 'endet mit',
      equals: 'ist gleich',
      greaterThan: 'größer als',
      lessThan: 'kleiner als',
      onDate: 'am',
      startsWith: 'beginnt mit'
    },
    quickValues: {
      title: 'Schnellwerte'
    },
    aria: {
      operatorFor: 'Filteroperator für {{column}}',
      valueFor: 'Filterwert für {{column}}'
    }
  },
  search: {
    placeholder: 'Suchen...'
  },
  summary: {
    button: {
      title: 'Zusammenfassung'
    },
    none: 'Keine',
    empty: 'Keine Spalte lässt sich zusammenfassen',
    types: {
      average: 'Durchschnitt',
      count: 'Anzahl',
      maximum: 'Maximum',
      minimum: 'Minimum',
      sum: 'Summe'
    }
  },
  actions: {
    delete: 'Löschen',
    edit: 'Bearbeiten',
    showDetails: 'Details anzeigen',
    hideDetails: 'Details ausblenden'
  },
  aria: {
    tableData: 'Tabellendaten',
    filterBar: 'Filterleiste',
    searchData: 'Daten durchsuchen',
    removeItem: '{{content}} entfernen',
    scrollLeft: 'Nach links scrollen',
    scrollRight: 'Nach rechts scrollen',
    interactiveCell: 'Interaktive Zelle',
    tools: 'Tabellenwerkzeuge',
    toolsActive: 'Tabellenwerkzeuge, {{count}} aktiv'
  },
  copy: {
    button: 'Kopieren',
    copied: 'Kopiert',
    failed: 'Fehlgeschlagen'
  },
  error: {
    loadingError: 'Fehler beim Laden',
    genericMessage: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
    retry: 'Erneut versuchen',
    fetchFailed: 'Daten konnten nicht geladen werden'
  },
  columns: {
    visibility: 'Spaltensichtbarkeit',
    empty: 'Alle Spalten sind fixiert'
  },
  grouping: {
    button: 'Gruppierung',
    none: 'Keine Gruppierung'
  },
  sort: {
    button: 'Sortierung',
    none: 'Keine Sortierung',
    ascending: 'Aufsteigend',
    descending: 'Absteigend',
    direction: 'Sortierrichtung'
  },
  tools: {
    title: 'Tabellenwerkzeuge',
    done: 'Fertig',
    // Names the column list inside the sort/grouping sections. The section
    // heading already says which tool it is, so the list says what it picks.
    column: 'Spalte'
  },
  header: {
    activeFilter: 'Aktiver Filter',
    activeIndicator: '{{type}} aktiv für diese Spalte',
    collapseAllGroups: 'Alle Gruppen einklappen',
    expandAllGroups: 'Alle Gruppen ausklappen',
    groupedColumn: 'Gruppierte Spalte',
    summarizedColumn: 'Zusammengefasste Spalte'
  },
  headerMenu: {
    sortAscending: 'Aufsteigend sortieren',
    sortDescending: 'Absteigend sortieren',
    removeFilter: 'Filter entfernen',
    groupByColumn: 'Nach Spalte gruppieren',
    removeGrouping: 'Gruppierung aufheben',
    addSummary: 'Zusammenfassung hinzufügen',
    removeSummary: 'Zusammenfassung entfernen',
    hideColumn: 'Spalte ausblenden',
    showColumn: 'Anzeigen',
    columnOptions: 'Spaltenoptionen für'
  },
  pagination: {
    previous: 'Zurück',
    next: 'Weiter',
    first: 'Erste',
    last: 'Letzte',
    page: 'Seite'
  },
  group: {
    noGroup: '(Keine Gruppe)',
    item: 'Eintrag',
    items: 'Einträge',
    itemOnPage: 'Eintrag auf dieser Seite',
    itemsOnPage: 'Einträge auf dieser Seite',
    summaryFor: 'Zusammenfassung für'
  },
  number: {
    valueLabel: 'Wert: {{value}}'
  },
  status: {
    tooltip: 'Status: {{text}}',
    clickToChange: '(klicken zum Ändern)',
    unknown: 'Unbekannt',
    active: 'Aktiv',
    inactive: 'Inaktiv',
    pending: 'Ausstehend',
    online: 'Online',
    offline: 'Offline',
    processing: 'In Bearbeitung',
    completed: 'Abgeschlossen',
    failed: 'Fehlgeschlagen',
    draft: 'Entwurf',
    published: 'Veröffentlicht',
    archived: 'Archiviert'
  },
  liveUpdates: {
    newItems: 'neu',
    updatedItems: 'aktualisiert',
    deletedItems: 'entfernt',
    apply: 'Änderungen übernehmen',
    dismiss: 'Verwerfen'
  },
  selection: {
    selectRow: 'Zeile auswählen',
    deselectRow: 'Auswahl aufheben',
    selectAllRows: 'Alle Zeilen auswählen',
    deselectAllRows: 'Auswahl aller Zeilen aufheben'
  },
  table: {
    link: {
      invalid: 'Ungültiger Link'
    },
    summary: {
      totalSummary: 'Gesamtzusammenfassung'
    }
  }
} as const;
