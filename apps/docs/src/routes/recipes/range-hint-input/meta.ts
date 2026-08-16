import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Beginner',
  title: 'Range Hint Input',
  description:
    'A number field whose helper text names the expected range and follows the typed value: success inside it, warning just outside, danger far outside. Nothing blocks: a far-off value stays enterable, it just reads as unusual.',
  components: ['Input'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Three zones from one range: inside expectedRange is success, within the tolerance band warning, beyond it danger; an empty field shows the bare range.',
    'tolerancePercent sizes the warning band as a share of the range width (default 15), so one number fits 7–9 h and 12,000–13,500 kWh alike.',
    'The status feeds Input directly: it tints the field border via intent while the message keeps the quiet helper voice; the error prop stays free for hard validation.',
    'Nothing blocks: out-of-range values stay enterable, and helpOnDanger appends a domain question ("Typo or meter replaced?") to the danger message.',
    'Per-field config objects (expectedRange, tolerancePercent, helpOnDanger, formatRange) share one classify and one format function; a new field is a config, not a component.'
  ]
};
