import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Beginner',
  title: 'Page Header',
  description:
    'A top-of-page header in plain markup: eyebrow or breadcrumb, title, subtitle, and an action row that stacks below them on narrow screens. Three variants: list page, detail page with a Breadcrumb, tabbed page with a Tab strip.',
  components: ['Button', 'Breadcrumb', 'Tab'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Three header variants, each a self-contained snippet: list page (eyebrow, title, subtitle, primary action), detail page (Breadcrumb trail plus a ghost/primary action pair), tabbed page (heading row above a line-variant Tab strip).',
    'Plain markup around Button, Breadcrumb and Tab; no wrapper component, no state beyond the tab binding.',
    'Below the sm breakpoint the action row stacks under the title block; flex-wrap lets a multi-button row break instead of squeezing the title.',
    'Headings are h1, dropped to h2 (and text-2xl) inside a Dialog or Drawer or on a route that already renders an h1.',
    'Eyebrow and Breadcrumb share the slot above the title: a category label on the list header, a route trail on the detail header, never both.'
  ]
};
