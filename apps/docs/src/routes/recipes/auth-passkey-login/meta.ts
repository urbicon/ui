import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Advanced',
  title: 'Passkey Login',
  description:
    'Passwordless and password sign-in in one form, backed by the WebAuthn passkey handlers.',
  components: ['LoginPage'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Email/password and passkey sign-in in one form (mode="both").',
    'Discoverable (usernameless) passkey login: with the email field empty, the browser offers every credential for the rpId.',
    'createPasskeyHandlers returns all six passkey handlers; the recipe mounts authenticationOptions and authenticationVerify as SvelteKit routes.',
    'Per-ceremony challenge kept in the webauthn challengeStore and pinned to the browser by a single-use HttpOnly cookie; pass a persistent ChallengeStore when running more than one instance.',
    'CSRF-protected requests through the bundled csrfFetch.',
    'passkey.registrationOptions/Verify and passkey.list/item serve the separate PasskeyManager component, where signed-in users add and remove credentials.'
  ]
};
