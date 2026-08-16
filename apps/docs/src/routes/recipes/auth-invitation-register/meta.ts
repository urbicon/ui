import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Intermediate',
  title: 'Invitation-Gated Registration',
  description:
    'Admin-minted invitations gate sign-up: the RegisterPage only succeeds for an invited email.',
  components: ['RegisterPage', 'InvitationManager'],
  // Nothing on the docs site renders these: the cookbook card shows title,
  // description and components, and this page dropped the feature list in
  // favour of the demo. Their one consumer is `get_recipe`, so they are written
  // for an agent deciding whether this recipe fits — facts, not aphorisms.
  features: [
    'Registration is gated on possession of an admin-minted invitation token for the exact invited email.',
    'InvitationManager admin panel creates, lists and revokes invitations over the createInvitationHandlers routes; you supply only the authorize gate and the roles.',
    'The invitation is claimed atomically (markUsedIfUnused) after the user create, so one invite yields one account and a failed create never burns it.',
    'The same invitation_required 403 for any request without a valid token, so registration status never leaks.',
    'Email verification link sent on successful registration.',
    'Auto-login on success via the established session.'
  ]
};
