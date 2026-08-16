import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Display',
  difficulty: 'Intermediate',
  title: 'Trace Drawer',
  description:
    'A "How was this calculated?" drawer for an aggregated figure. It traces the value through every intermediate formula down to the receipts and meter readings it came from, one indented level per step.',
  components: ['Drawer', 'Card', 'Button', 'Badge'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'TraceNode is self-similar ({ label, value, formula?, reference?, children? }): aggregates carry a formula and children, leaves a reference. One top-level snippet renders itself via {@render} for arbitrary depth.',
    'Nesting is drawn without boxes: children sit in a ul with a border-l guide line and pl-3 indent, so every value keeps one shared right edge.',
    'value and formula are preformatted strings (the trace mixes €, % and kWh); the engine that calculates formats, the drawer only lays out.',
    'reference renders as a soft neutral Badge naming the document a leaf cites (receipt, invoice, meter reading).',
    'The trigger is a summary figure on an elevated Card; the Drawer (placement="right", size="lg") holds the tree, and its footer snippet carries Close plus an export stand-in.'
  ]
};
