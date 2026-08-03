import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Forms',
  difficulty: 'Intermediate',
  title: 'Settings Page',
  description:
    'Compact tabbed settings page — profile, notifications, and security as flat, co-equal sections with a single save. The small-scale shape of the settings-page pattern (larger or hierarchical settings use a sidebar).',
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
  features: [
    'Tab navigation for Profile, Notifications, and Security',
    'Textarea with character counter for bio',
    'Select menu for timezone and language',
    'Notification toggles with descriptions',
    'Accordion for advanced security settings',
    'Save action with success feedback'
  ]
};
