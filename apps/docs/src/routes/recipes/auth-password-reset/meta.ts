import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Intermediate',
  title: 'Password Reset Flow',
  description:
    'The two-page forgot/reset flow: request a link, then set a new password from the emailed token.',
  components: ['ForgotPasswordPage', 'ResetPasswordPage'],
  features: [
    'ForgotPasswordPage requests a reset link by email',
    'Timing-safe and enumeration-safe — always the same fire-and-forget response',
    'ResetPasswordPage consumes the token and sets a new password',
    'Reset token claimed atomically (consumeResetToken) so one link is single-use',
    'All sessions invalidated on a successful reset',
    'onPasswordResetFailed hook surfaces a broken mail transport'
  ]
};
