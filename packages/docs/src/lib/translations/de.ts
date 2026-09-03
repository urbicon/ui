export default {
  // TableOfContents
  tocLandmarkLabel: 'Seiteninhalt',
  tocOnThisPage: 'Auf dieser Seite',
  tocRelated: 'Siehe auch',
  tocCode: 'Code',

  // Playground
  interactivePlayground: 'Playground',
  // Bewusst leer: der Wert ist der Default des optionalen `subtitle`-Props —
  // ohne Angabe der Seite (oder der Locale) zeigt ein Playground keinen Untertitel.
  playgroundSubtitle: '',

  // API Reference
  // Zählwerte in der Statuszeile. So formuliert, dass eine Fassung für jede
  // Anzahl passt — die Laufzeit interpoliert, wählt aber keinen Plural.
  propsCount: '{{count}} Props',
  requiredCount: '{{count}} erforderlich',
  filterProperties: 'Properties filtern…',
  noMatchingProperties: 'Keine passenden Properties',
  badgeVariant: 'Variante',
  badgeInherited: 'geerbt',
  badgeRequired: 'erforderlich',
  badgeDeprecated: 'veraltet',
  badgeExperimental: 'experimentell',
  property: 'Prop',
  type: 'Typ',
  default: 'Standard',
  description: 'Beschreibung',
  noApiProperties: 'Keine API-Properties',
  noApiPropertiesBody: 'Für diese Komponente wurden keine API-Properties gefunden.',
  // Ausgeklappte Prop-Zeile. `declaredIn` benennt das Interface, aus dem eine
  // Prop stammt — in den generierten Daten bei jeder Prop vorhanden, aber bis
  // zur ausklappbaren Zeile nirgends sichtbar: das Badge „geerbt"/„Variante"
  // sagte, DASS eine Prop geerbt ist, nie woher.
  declaredIn: 'Deklariert in:',
  allValues: 'Werte:',

  // TypesReference
  typesTitle: 'Typen',
  typesDescription: 'Lokale Typdefinitionen, die diese Komponente verwendet.',
  typeName: 'Name',
  typeKind: 'Art',
  typeCategory: 'Kategorie',
  typeUsedBy: 'Verwendet von',
  typesCount: '{{count}} Typen',
  onlyReferenced: 'Nur referenzierte',
  searchTypes: 'Typen suchen…',
  moreValues: '+{{count}} weitere',
  categoryProps: 'Props',
  categoryVariant: 'Variante',
  categoryHelper: 'Hilfstyp',
  seeAlsoLabel: 'Siehe',
  usedByLabel: 'Verwendet von:',
  noTypesMatch: 'Keine Typen passen zum aktuellen Filter.',

  // DocsLayout
  stabilityLabel: 'Stabilität: {{stability}}',
  sourceLink: 'Quelle',
  breadcrumbLabel: 'Brotkrumen-Navigation',

  // CodeExample
  hideCode: 'Code verstecken',
  showCode: 'Code anzeigen',
  hideAllCode: 'Alle Code-Beispiele verstecken',
  showAllCode: 'Alle Code-Beispiele anzeigen',
  copied: 'Kopiert!',
  copy: 'Kopieren',
  codeExample: 'Code-Beispiel',
  codeExampleLabeled: 'Code-Beispiel: {{title}}',

  // PlaygroundConfigurator
  variantAxisTooltip: 'Stil-Variante',
  defaultBadge: 'Standard',
  resetControlTitle: 'Standard: {{value}}. Klicken zum Zurücksetzen.',
  resetControlLabel: '{{label}} auf den Standard zurücksetzen',
  playgroundModified: 'Geänderte Einstellungen: {{count}}',
  resetAll: 'Alle zurücksetzen ({{count}})',
  hints: 'Hinweise',
  hintsOn: 'Hinweise an',
  copyLink: 'Link kopieren',
  linkCopied: 'Link kopiert!',

  // InfoCard
  noteLabel: 'Hinweis',

  // CodeExample fallback
  codeExtractionFallback:
    'Code wird automatisch extrahiert. Falls das nicht funktioniert, überprüfe die Vite-Konfiguration.'
} as const;
