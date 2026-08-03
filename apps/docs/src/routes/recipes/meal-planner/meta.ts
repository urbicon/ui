import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'planning-board',
  category: 'Display',
  difficulty: 'Intermediate',
  title: 'Meal Planner',
  description:
    'Weekly meal plan built on Planner — meals bucketed by day, sorted by meal type, with an add affordance that lives on every day including empty ones.',
  components: ['Planner', 'Button', 'Badge'],
  features: [
    'Planner buckets a typed MealEntry[] by local day via getDate — no manual date math',
    'sort orders meals within a day (breakfast → lunch → dinner)',
    'The cell snippet renders your own markup and runs for empty days, so "Add" is always reachable',
    'onNavigate hands you the visible week range to load data per week',
    'bind:selectedDate tracks the active day; clicking a cell body selects it',
    'Server and client agree on the week via the Svelte-free @urbicon-ui/blocks/date subpath'
  ]
};
