import type { RecipeMeta } from '../recipe-meta';

export const recipeMeta: RecipeMeta = {
  category: 'Authentication',
  difficulty: 'Intermediate',
  title: 'Invitation-Gated Registration',
  description:
    'Admin-minted invitations gate sign-up: the RegisterPage only succeeds for an invited email.',
  components: ['RegisterPage', 'InvitationManager'],
  features: [
    'Registration requires an admin-created invitation for the exact email',
    'InvitationManager admin panel to create list and revoke invitations',
    'Invitation claimed atomically (markUsedIfUnused) so one invite yields one account',
    'Same 403 for any uninvited email so registration status never leaks',
    'Email verification link sent on successful registration',
    'Auto-login on success via the established session'
  ]
};
