export default {
  // Navigation & Layout
  contents: 'Inhaltsverzeichnis',

  // TableOfContents
  tocOnThisPage: 'Auf dieser Seite',
  tocRelated: 'Siehe auch',
  tocCode: 'Code',

  // Playground
  livePreview: 'Live-Vorschau',
  configuration: 'Konfiguration',
  interactivePlayground: 'Playground',
  playgroundSubtitle: '',
  generatedCode: 'Generierter Code',
  currentConfiguration: 'Aktuelle Konfiguration',

  // API Reference
  apiReference: 'API-Referenz',
  apiDescription: 'Verfügbare Properties und Methoden',
  property: 'Eigenschaft',
  type: 'Typ',
  default: 'Standard',
  description: 'Beschreibung',
  usageNotes: 'Nutzungshinweise',
  required: 'Erforderlich',
  requiredPropsNote:
    'Eigenschaften, die als erforderlich markiert sind, müssen angegeben werden, damit die Komponente korrekt funktioniert.',

  // CodeExample
  hideCode: 'Code verstecken',
  showCode: 'Code anzeigen',
  hideAllCode: 'Alle Code-Beispiele verstecken',
  showAllCode: 'Alle Code-Beispiele anzeigen',
  codeAuto: 'Auto',
  copied: 'Kopiert!',
  copy: 'Kopieren',
  loadingSyntax: 'Syntax-Highlighting wird geladen...',
  codeExample: 'Code-Beispiel',
  codeExampleLabeled: 'Code-Beispiel: {{title}}',

  // PlaygroundConfigurator
  selectOption: 'Wähle {{option}}...',
  enableOption: '{{option}} aktivieren',
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
