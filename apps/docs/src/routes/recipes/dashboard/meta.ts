import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'dashboard',
  category: 'Layout',
  difficulty: 'Intermediate',
  title: 'Dashboard Layout',
  description:
    'An app shell built on SidebarLayout, with a permanent rail on desktop and a slide-in overlay on mobile. The page inside: four stat tiles, a revenue bar chart and an activity feed.',
  components: [
    'SidebarLayout',
    'Card',
    'BarChart',
    'Progress',
    'Badge',
    'Avatar',
    'Tooltip',
    'Button'
  ],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'SidebarLayout is the shell: a permanent 14rem rail at 1024px and up, a slide-in overlay below, opened from the mobileHeader snippet via bind:open.',
    'Meant for the layout file, mounted once with routes as its children; the header row, stat grid, chart and feed are the routed page.',
    'Stat tiles are elevated Cards: value and intent-coloured change Badge on one baseline, an xs Progress toward the target, the target named in a Tooltip.',
    'BarChart with a single series over twelve months (height 192, legend off); the activity feed is Avatar rows in a second elevated Card.',
    'Rail navigation is local activeRoute state with aria-current on the active item, a stand-in for router links.'
  ]
};
