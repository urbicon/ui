import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'planning-board',
  category: 'Display',
  difficulty: 'Intermediate',
  title: 'Meal Planner',
  description:
    'A week of meals on Planner: typed entries bucketed onto their local day, ordered within each day by meal type, with an Add button that stays reachable on empty days.',
  components: ['Planner', 'Button', 'Badge'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    "Planner buckets a typed MealEntry[] by calendar day via getDate; a local ISO date string ('2026-06-16') is taken verbatim, never UTC-parsed.",
    'sort orders meals inside a day cell (breakfast → lunch → dinner via a MEAL_ORDER record).',
    'The cell snippet renders the meal chips and runs for empty days too, which keeps the ghost Add button reachable; an empty snippet would replace it there.',
    'bind:value anchors the visible week, bind:selectedDate tracks the active day (click / Enter / Space on a cell).',
    'The demo keeps one local array; onNavigate(date, range) is the seam for per-week loading, with toIso/endOfWeek from the Svelte-free @urbicon-ui/blocks/date subpath for server-side week math.'
  ]
};
