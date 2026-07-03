import type { PartialAuthLocale } from '../../../i18n/keys.js';
import type { CsrfClientOptions } from '../../csrf.js';
import type { RoleOption } from '../types.js';

/**
 * @description Admin panel for managing invitation-gated registration with email toggle.
 * Communicates with `apiPath` (default `/api/invitations`). Pair with `createInvitationHandlers(authDeps, { authorize, roles })` on the server — mount its `POST` + `GET` on `/api/invitations` and `DELETE` on `/api/invitations/[id]`.
 *
 * @tag form
 * @related RegisterPage
 *
 * @example
 * ```svelte
 * <InvitationManager {t} roles={[{ value: 'ADMIN', label: 'Admin' }, { value: 'USER', label: 'User' }]} />
 * ```
 */
export interface InvitationManagerProps {
  /**
   * Locale overrides, deep-merged over the active built-in bundle (resolved
   * from the i18n context). Pass any subset — a single string or a whole tree.
   */
  t?: PartialAuthLocale;
  /** Available roles for the invitation menu. */
  roles: RoleOption[];
  /** API endpoint. @default '/api/invitations' */
  apiPath?: string;
  /** CSRF cookie/header names — only needed when the server overrides the defaults via `config.csrf`. Mutating requests echo the token automatically. */
  csrf?: CsrfClientOptions;
  /** Custom fetch implementation for all API calls. Defaults to the global `fetch`. Useful for mock backends in demos/tests or custom retry/auth layers. */
  fetcher?: typeof globalThis.fetch;
  /** Strip all default styling. */
  unstyled?: boolean;
  /** Per-slot class overrides. See component source for available slot keys. */
  slotClasses?: Partial<Record<'root' | 'title' | 'form' | 'list' | 'item' | 'error', string>>;
  /** Extra classes on the root element. */
  class?: string;
}

export type { RoleOption } from '../types.js';
export { default as InvitationManager } from './InvitationManager.svelte';
