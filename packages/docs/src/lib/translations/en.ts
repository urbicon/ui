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
  // Counts in the stats line. Phrased so one wording fits any count — the
  // runtime interpolates but has no plural selection.
  propsCount: '{{count}} props',
  requiredCount: '{{count}} required',
  filterProperties: 'Filter properties…',
  noMatchingProperties: 'No matching properties',
  badgeVariant: 'variant',
  badgeInherited: 'inherited',
  badgeRequired: 'required',
  property: 'Prop',
  type: 'Type',
  default: 'Default',
  description: 'Description',
  noApiProperties: 'No API Properties',
  noApiPropertiesBody: 'No API properties found for this component.',

  // TypesReference
  typesTitle: 'Types',
  typesDescription: 'Local type definitions used by this component.',
  typeName: 'Name',
  typeKind: 'Kind',
  typeCategory: 'Category',
  typeUsedBy: 'Used by',
  typesCount: '{{count}} types',
  onlyReferenced: 'Only referenced',
  searchTypes: 'Search types…',
  moreValues: '+{{count}} more',
  categoryProps: 'props',
  categoryVariant: 'variant',
  categoryHelper: 'helper',
  seeAlsoLabel: 'See',
  usedByLabel: 'Used by:',
  noTypesMatch: 'No types match the current filter.',

  // DocsLayout
  stabilityLabel: 'Stability: {{stability}}',
  sourceLink: 'source',
  breadcrumbLabel: 'Breadcrumb',

  // CodeExample
  hideCode: 'Hide Code',
  showCode: 'Show Code',
  hideAllCode: 'Hide All Code',
  showAllCode: 'Show All Code',
  copied: 'Copied!',
  copy: 'Copy',
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

  // InfoCard
  noteLabel: 'Note',

  // CodeExample fallback
  codeExtractionFallback:
    'Code is extracted automatically. If this is not working, check the Vite configuration.'
} as const;
