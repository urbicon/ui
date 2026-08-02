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
  property: 'Prop',
  type: 'Typ',
  default: 'Standard',
  description: 'Beschreibung',
  usageNotes: 'Nutzungshinweise',
  required: 'Erforderlich',
  noApiProperties: 'Keine API-Properties',
  noApiPropertiesBody: 'Für diese Komponente wurden keine API-Properties gefunden.',

  // TypesReference
  seeAlsoLabel: 'Siehe',
  usedByLabel: 'Verwendet von:',
  noTypesMatch: 'Keine Typen passen zum aktuellen Filter.',

  // DocsLayout
  breadcrumbLabel: 'Brotkrumen-Navigation',

  // CodeExample
  hideCode: 'Code verstecken',
  showCode: 'Code anzeigen',
  hideAllCode: 'Alle Code-Beispiele verstecken',
  showAllCode: 'Alle Code-Beispiele anzeigen',
  copied: 'Kopiert!',
  copy: 'Kopieren',
  loadingSyntax: 'Syntax-Highlighting wird geladen...',
  codeExample: 'Code-Beispiel',
  codeExampleLabeled: 'Code-Beispiel: {{title}}',

  // PlaygroundConfigurator
  variantAxisTooltip: 'Stil-Variante (tailwind-variants)',
  defaultBadge: 'Standard',
  resetControlTitle: 'Standard: {{value}}. Klicken zum Zurücksetzen.',
  resetControlLabel: '{{label}} auf den Standard zurücksetzen',
  playgroundModified: 'Geänderte Einstellungen: {{count}}',
  resetAll: 'Alle zurücksetzen ({{count}})',
  hints: 'Hinweise',
  hintsOn: 'Hinweise an',
  copyLink: 'Link kopieren',
  linkCopied: 'Link kopiert!',

  // CodeExample fallback
  codeExtractionFallback:
    'Code wird automatisch extrahiert. Falls das nicht funktioniert, überprüfe die Vite-Konfiguration.'
} as const;
