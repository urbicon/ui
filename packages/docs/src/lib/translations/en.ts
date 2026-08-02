export default {
  // TableOfContents
  tocLandmarkLabel: 'Page contents',
  tocOnThisPage: 'On this page',
  tocRelated: 'Related',
  tocCode: 'Code',

  // Playground
  interactivePlayground: 'Playground',
  // Empty on purpose: it is the default for the optional `subtitle` prop, so a
  // playground shows no subtitle unless a page (or a locale) supplies one.
  playgroundSubtitle: '',

  // API Reference
  property: 'Prop',
  type: 'Type',
  default: 'Default',
  description: 'Description',
  usageNotes: 'Usage Notes',
  required: 'Required',
  noApiProperties: 'No API Properties',
  noApiPropertiesBody: 'No API properties found for this component.',

  // TypesReference
  seeAlsoLabel: 'See',
  usedByLabel: 'Used by:',
  noTypesMatch: 'No types match the current filter.',

  // DocsLayout
  breadcrumbLabel: 'Breadcrumb',

  // CodeExample
  hideCode: 'Hide Code',
  showCode: 'Show Code',
  hideAllCode: 'Hide All Code',
  showAllCode: 'Show All Code',
  copied: 'Copied!',
  copy: 'Copy',
  loadingSyntax: 'Loading syntax highlighting...',
  codeExample: 'Code example',
  codeExampleLabeled: 'Code example: {{title}}',

  // PlaygroundConfigurator
  variantAxisTooltip: 'Style variant (tailwind-variants)',
  defaultBadge: 'default',
  resetControlTitle: 'Default: {{value}}. Click to reset.',
  resetControlLabel: 'Reset {{label}} to default',
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
