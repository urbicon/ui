import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Beginner',
  title: 'Stat Tile',
  description:
    "A KPI tile with a label, a large aligned value, a trend beside its baseline, and an icon square washed in the tile's intent colour. Shown as a linked 4-up grid, a compact strip, and one elevated highlight tile.",
  components: ['Card'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Tile anatomy: label over a tabular-nums value plus a description line; a trending tile names its baseline there ("vs. last month").',
    'The icon square is a label, not content: right-aligned, rounded-bridge, coloured via one Record<Intent, string> of bg-{intent}-subtle washes (warning draws in text-warning-emphasis for contrast).',
    'The trend arrow is coloured by direction (up success, down danger), valid only while up means good; for consumption/churn-type metrics derive the colour from the data, as intent already is.',
    'Each grid tile is Card variant="elevated" tier="bridge" with href: it renders as an <a> and lifts further on hover through the interactive styles Card derives from href.',
    'Three variants: a sm:grid-cols-2 / lg:grid-cols-4 grid, a quiet-Card strip of bare label/value pairs for sidebars, and one elevated hero tile (padding="lg") with a larger icon square.'
  ]
};
