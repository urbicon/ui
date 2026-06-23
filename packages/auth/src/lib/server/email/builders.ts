import type { AuthLocale } from '../../i18n/keys.js';
import type { BuiltEmail } from './templates.js';

/**
 * Context handed to every per-mail builder hook (verification, reset,
 * change-email, …). Mirrors what the default builder receives, so a consumer
 * hook can reproduce or extend the default mail:
 *
 * - `name` — the recipient's display name (empty for invitations).
 * - `url` — the action link (verify / reset / confirm / register).
 * - `appName` — resolved app name (`config.email.appName` or the `appUrl` host).
 * - `from` — the resolved sender (with `fromName` applied); the builder may
 *   return a different `from` on the result to override per-mail.
 * - `t` — the localized `AuthLocale` bundle for `config.email.locale`.
 */
export interface MailBuilderContext {
  name: string;
  url: string;
  appName: string;
  from?: string;
  t: AuthLocale;
}

/**
 * A per-mail builder hook. Returns the rendered mail; may include a `from` to
 * override the configured sender for this one message. The return widens
 * {@link BuiltEmail} with an optional `from`.
 */
export type MailBuilder<Ctx = MailBuilderContext> = (ctx: Ctx) => BuiltEmail & { from?: string };

/** Context for the email-change *notice* (sent to the old address). */
export interface ChangeEmailNoticeContext extends Omit<MailBuilderContext, 'url'> {
  /** The pending new address the change was requested for. */
  newEmail: string;
}
