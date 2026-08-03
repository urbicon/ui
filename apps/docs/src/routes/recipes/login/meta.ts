import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'form-page',
  category: 'Authentication',
  difficulty: 'Beginner',
  title: 'Login Form',
  description:
    'Complete authentication form with validation, password visibility, and demo credentials.',
  components: ['Input', 'Button', 'Checkbox', 'Card', 'Alert', 'Separator'],
  features: [
    'Client-side email and password validation',
    'Show/hide password toggle',
    'Loading state with spinner on submit',
    'Dismissible error alerts',
    'Success state with redirect message',
    'Remember me checkbox',
    'Responsive centered layout'
  ]
};
