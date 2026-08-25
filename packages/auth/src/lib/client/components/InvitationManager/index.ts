import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { RoleOption } from '../types.js';

/**
 * @summary Admin view for invitation-gated signup: who was invited, and who has not answered.
 * @description Admin panel for managing invitation-gated registration with email toggle.
 * Communicates with `apiPath` (default `/api/invitations`). Pair with `createInvitationHandlers(authDeps, { authorize, roles })` on the server — mount its `POST` + `GET` on `/api/invitations` and `DELETE` on `/api/invitations/[id]`.
 *
 * @tag form
 * @related RegisterPage
 * @stability beta
 *
 * @example
 * ```svelte
 * <InvitationManager {t} roles={[{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]} />
 * ```
 */
export interface InvitationManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset, from a single string to a whole tree.
   */
  t?: PartialAuthLocale;
  /** Available roles for the invitation menu. */
  roles: RoleOption[];
  /** API base path for the invitation endpoints. @default '/api/invitations' */
  apiPath?: string;
  /** CSRF cookie/header names. Only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<
    Record<'root' | 'title' | 'form' | 'list' | 'item' | 'empty' | 'error' | 'inviteLink', string>
  >;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ InvitationManager: { … } }}>`.
   * Resolves after the provider defaults and before this instance's own
   * `slotClasses`, so a project-wide look lives in one place instead of being
   * repeated at every usage site.
   */
  preset?: string;
  /** Extra classes on the root element. */
  class?: string;
}

export type { RoleOption } from '../types.js';
export { default as InvitationManager } from './InvitationManager.svelte';
