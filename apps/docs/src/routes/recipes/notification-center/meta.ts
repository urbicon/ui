import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Intermediate',
  title: 'Notification Center',
  description:
    'A bell button whose badge counts unread notifications, opening a drawer with All and Unread tabs, mark-as-read and archive per item, and a mark-all footer.',
  components: ['Drawer', 'Tab', 'Badge', 'Avatar', 'Button', 'Tooltip'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'A Button trigger whose soft danger Badge shows the unread count; the count, the tab badge and the footer state all derive from one notifications array.',
    'A right-hand Drawer (bind:open, no onClose needed) holding a line-variant Tab: the All and Unread panels render the same list snippet.',
    'Per-item actions in Tooltips: mark-as-read flips a flag (the item dims in All and leaves Unread by derivation), archive removes it from the array.',
    'The empty state lives inside the shared snippet, so an emptied filter or an emptied feed shows it in either tab.',
    'Footer: a mark-all-as-read Button disabled at zero unread, plus the total count. State is local; the three mutation functions are the API seam.'
  ]
};
