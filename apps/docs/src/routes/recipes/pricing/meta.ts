import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Marketing',
  difficulty: 'Beginner',
  title: 'Pricing Cards',
  description:
    'Three pricing tiers with a monthly/annual billing toggle. The recommended plan is the one elevated card and holds the only filled primary button; features a plan lacks stay listed, greyed out with a tooltip.',
  components: ['Card', 'Badge', 'Button', 'Separator', 'SegmentGroup', 'Tooltip'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'A SegmentGroup switches billing; the prices and the billed-per-year line derive from its one monthly/annual state.',
    'Each plan carries priceMonthly and priceAnnual as data; nothing computes the discount, the Save-20% Badge is copy.',
    'The recommended plan is Card variant="elevated" with a primary Badge and the only filled primary Button; the other plans are variant="quiet" with outlined neutral buttons.',
    'Features a plan lacks stay listed: greyed out, CloseIcon, and a Tooltip naming the reason; included ones carry a success CheckIcon.',
    'The plan grid is one column below md and three from md up, top-aligned.'
  ]
};
