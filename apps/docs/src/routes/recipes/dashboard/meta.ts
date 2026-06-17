export const recipeMeta = {
  pattern: 'dashboard',
  title: 'Dashboard Layout',
  description:
    'App-shell pattern built on SidebarLayout — persistent sidebar on desktop, slide-in overlay on mobile, with stat cards, chart, and activity feed.',
  components: ['SidebarLayout', 'Card', 'Badge', 'Avatar', 'Button', 'Progress', 'Tooltip'],
  features: [
    'SidebarLayout as the app shell — responsive sidebar with mobile hamburger overlay',
    'Stat cards with equal height and baseline-aligned values',
    'Tooltip with explicit placement to avoid Floating-UI drift on tight grids',
    'Revenue chart with consistent month-label spacing',
    'Activity feed stacked full-width under the chart',
    'Active-route highlighting on sidebar navigation'
  ]
};
