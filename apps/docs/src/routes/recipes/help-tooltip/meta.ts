import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Beginner',
  title: 'Help Tooltip',
  description:
    'An info icon beside a label that opens the definition of a domain term in a tooltip, fed from one glossary map; in running text the term itself is the trigger. Built for interfaces with specialist vocabulary: heating-cost billing here, tax or payroll just as well.',
  components: ['Tooltip', 'Button', 'Slider', 'Input'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Four trigger contexts fed by one glossary: a slider label row, an input label, a table header, and a dotted term inside running text.',
    'HelpTooltip.svelte wraps Tooltip around a ghost 2xs icon Button; the required term prop becomes aria-label="Explanation: <term>", and intent="warning"/"danger" tints the panel for risk-relevant hints.',
    'glossary.ts maps keys to { term, text } as const, so a lookup on a removed key is a type error at the trigger that used it; with i18n, one map per locale.',
    'The tooltip opens on hover and on keyboard focus, and Escape closes it from the focused trigger; the icon Button is focusable by nature, the inline span adds tabindex="0" for it.',
    'The hand-built label rows wire themselves to their controls: aria-labelledby for the Slider, for/id for the Input.'
  ]
};
