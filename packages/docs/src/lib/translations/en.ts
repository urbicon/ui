export default {
  // Navigation & Layout
  contents: 'Contents',

  // TableOfContents
  tocOnThisPage: 'On this page',
  tocRelated: 'Related',
  tocCode: 'Code',

  // Playground
  livePreview: 'Live Preview',
  configuration: 'Configuration',
  interactivePlayground: 'Playground',
  playgroundSubtitle: '',
  generatedCode: 'Generated Code',
  currentConfiguration: 'Current Configuration',

  // API Reference
  apiReference: 'API Reference',
  apiDescription: 'Available properties and methods',
  property: 'Property',
  type: 'Type',
  default: 'Default',
  description: 'Description',
  usageNotes: 'Usage Notes',
  required: 'Required',
  requiredPropsNote:
    'Properties marked as required must be provided for the component to function correctly.',

  // CodeExample
  hideCode: 'Hide Code',
  showCode: 'Show Code',
  hideAllCode: 'Hide All Code',
  showAllCode: 'Show All Code',
  codeAuto: 'Auto',
  copied: 'Copied!',
  copy: 'Copy',
  loadingSyntax: 'Loading syntax highlighting...',
  codeExample: 'Code example',
  codeExampleLabeled: 'Code example: {{title}}',

  // PlaygroundConfigurator
  selectOption: 'Select {{option}}...',
  enableOption: 'Enable {{option}}',
  // Phrased so one wording fits any count — the runtime interpolates
  // `{{count}}` but has no plural selection.
  playgroundModified: 'Settings modified: {{count}}',
  resetAll: 'Reset all ({{count}})',
  hints: 'Hints',
  hintsOn: 'Hints on',
  copyLink: 'Copy link',
  linkCopied: 'Link copied!',

  // CodeExample fallback
  codeExtractionFallback:
    'Code is extracted automatically. If this is not working, check the Vite configuration.'
} as const;
