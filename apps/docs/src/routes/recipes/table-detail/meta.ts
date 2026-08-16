import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Intermediate',
  title: 'Table with Detail Panel',
  description:
    'An order list whose rows open in a panel beside the table, so clicking down the list swaps what the panel shows. Below 1024px the same detail arrives as a drawer.',
  components: ['Table', 'Drawer', 'Avatar', 'Badge'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'A detail panel beside the table on wide screens; a Drawer below 1024px. One snippet renders both.',
    "Table's onRowClick sets the shown record; activeRowId marks its row without adding a checkbox column.",
    'activeRowId is matched against item.id, with the position in the items array as fallback.',
    "The toolbar above the grid is Table's enableSmartFilter, on by default: search, filters, sort, grouping, summaries, column visibility.",
    'TableColumns builds the cells: .text, .status with an order-specific statusMap, .number as currency.'
  ]
};
