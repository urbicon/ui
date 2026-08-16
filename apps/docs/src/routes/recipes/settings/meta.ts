import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'settings-page',
  category: 'Forms',
  difficulty: 'Intermediate',
  title: 'Settings Page',
  description:
    'Profile, notifications and security as three flat tabs over shared page state, with one save for the whole page. When settings groups multiply, nest or own their own save, the same panels hang off a sidebar instead.',
  components: [
    'Tab',
    'Input',
    'Textarea',
    'Select',
    'Toggle',
    'Accordion',
    'Card',
    'Button',
    'Avatar',
    'Alert',
    'Separator',
    'Badge'
  ],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Profile, Notifications and Security as three panels of one line-variant Tab; the Cancel/Save footer sits below the Tab and covers all three.',
    'Every control binds page-level $state, so switching tabs loses no edits and one Save Changes commits the whole page.',
    'Notifications: three Toggle rows in one elevated padding-none Card, divided by hairlines; email starts on, push and marketing off.',
    'Security: a card-variant Accordion; the 2FA item pairs its Toggle with a Badge flipping success/warning, and enabling API access reveals an API key.',
    'handleSave is a stand-in for a save call: it flashes a dismissible success Alert that clears itself after three seconds.'
  ]
};
