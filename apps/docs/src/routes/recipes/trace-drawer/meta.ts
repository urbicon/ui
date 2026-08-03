import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Intermediate',
  title: 'Trace Drawer',
  description:
    'Hierarchical "How was this value calculated?" drawer. Clicking an aggregated result opens a drawer from the right with the full calculation pipeline — input values as leaves, formulas as sublabels.',
  components: ['Drawer', 'Card', 'Button', 'Badge'],
  features: [
    'Drawer layout with header / body / footer',
    'Nested list structure via a recursive snippet',
    'Formula display as a secondary label per step',
    'Source references as Badges with a link indicator',
    'Export action in the footer for PDF/clipboard'
  ]
};
