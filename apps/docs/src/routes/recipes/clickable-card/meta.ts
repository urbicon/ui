import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Beginner',
  title: 'Clickable Card',
  description:
    'Dashboard tiles that navigate and a team list whose cards act: href renders a Card as an anchor, onclick as a button, and hover, focus and mint styles arrive only with a real click source. A side-by-side comparison covers why the href belongs on the Card, not on a wrapper around it.',
  components: ['Card', 'Avatar'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'href renders the whole Card as one <a>: real navigation, a single tab stop, Cmd/middle-click open a new tab.',
    'onclick renders it as <button type="button">, for actions without navigation.',
    'clickable forces the <button> rendering without a handler, for wrappers that delegate clicks.',
    'Hover, focus-ring and mint styles are gated on href/onclick/clickable: no decorative-hover mode on a passive card (WCAG 3.2 Predictable).',
    'mint="translate" adds a hover lift; the mint engine sits out prefers-reduced-motion.',
    'Wrapping a Card in <a> keeps it a div with no interactive styles and nests any inner interactive content; put href on the Card instead.'
  ]
};
