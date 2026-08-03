import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Advanced',
  title: 'Passkey Login',
  description:
    'Passwordless and password sign-in in one form, backed by the WebAuthn passkey handlers.',
  components: ['LoginPage', 'PasskeyManager'],
  features: [
    'Email/password and passkey sign-in in one form (mode="both")',
    'Discoverable (usernameless) passkey login — no email field needed',
    'Server WebAuthn ceremony via createPasskeyAuthenticationOptions/Verify handlers',
    'Per-ceremony challenge pinned to a single-use HttpOnly cookie',
    'CSRF-protected requests through the bundled csrfFetch',
    'PasskeyManager lets signed-in users add and remove credentials'
  ]
};
