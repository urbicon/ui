import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Layout',
  difficulty: 'Intermediate',
  title: 'Notification Center',
  description: 'Slide-in notification panel with tabs, filtering, and action buttons.',
  components: ['Drawer', 'Tab', 'Badge', 'Avatar', 'Button', 'Separator', 'Tooltip'],
  features: [
    'Drawer panel sliding in from the right',
    'Tab filtering for All and Unread notifications',
    'Notification items with Avatar and timestamps',
    'Unread count Badge on trigger button',
    'Mark as read and archive actions with Tooltip',
    'Empty state when no notifications match filter'
  ]
};
