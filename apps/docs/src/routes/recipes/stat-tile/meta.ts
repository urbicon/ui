export const recipeMeta = {
  title: 'Stat Tile',
  description:
    'KPI tile for dashboards: label on top, large value, optional trend indicator and icon tile on the right. Combines Card, the icon-tile pattern, and semantic intent tokens. Generic pattern for any reporting/analytics surface.',
  components: ['Card', 'Badge'],
  features: [
    'Label · value · description hierarchy with tabular-nums for number alignment',
    'Optional icon tile on the right with intent color (bg-{intent}-subtle / text-{intent})',
    'Trend indicator as a Badge (positive: success, negative: danger)',
    'Clickable via href — navigates to the detail view',
    'Scales from a single tile to a grid (sm:grid-cols-2 / lg:grid-cols-4)'
  ]
};
