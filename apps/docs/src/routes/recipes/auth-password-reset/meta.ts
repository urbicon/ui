import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Intermediate',
  title: 'Password Reset Flow',
  description:
    'The two-page forgot/reset flow: request a link, then set a new password from the emailed token.',
  components: ['ForgotPasswordPage', 'ResetPasswordPage'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'ForgotPasswordPage requests a reset link by email.',
    'Enumeration-safe: the same confirmation for known and unknown addresses, with the mail sent fire-and-forget so response time does not leak account existence.',
    'ResetPasswordPage consumes the ?token= from the emailed link and sets the new password.',
    'Reset token claimed atomically (consumeResetToken), so one link is single-use.',
    'A successful reset invalidates all sessions: tokenVersion bump for access cookies, revokeAllForUser for refresh tokens.',
    'onPasswordResetFailed hook surfaces a broken mail transport, which fire-and-forget keeps out of the HTTP response.'
  ]
};
