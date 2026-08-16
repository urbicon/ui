import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  pattern: 'form-page',
  category: 'Authentication',
  difficulty: 'Beginner',
  title: 'Login Form',
  description:
    'An email/password card with inline validation, a password visibility toggle, and loading, failure and success states around a swappable sign-in call.',
  components: ['Input', 'Button', 'Checkbox', 'Card', 'Alert', 'Separator'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Validation waits for input: empty fields pass emailValid/passwordValid, canSubmit gates submission separately.',
    'Password visibility toggle: an icon-only button with aria-pressed and a label that flips with the state.',
    'The submit Button renders its own loading state; failure is a dismissible danger Alert, success replaces the form.',
    'handleLogin is a stand-in for a session call; demo credentials demo@example.com / password123.',
    'One elevated Card (padding="lg"), no wrapper chrome — centre it in the page layout of the app.'
  ]
};
