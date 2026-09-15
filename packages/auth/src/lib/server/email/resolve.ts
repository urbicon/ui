import type { Locale } from '@urbicon-ui/i18n';
import { hasAuthLocale, resolveAuthLocale } from '../../i18n/index.svelte.js';
import type { AuthLocale } from '../../i18n/keys.js';
import type { AuthConfig, AuthLogger } from '../../types.js';
import { applyFromName } from './templates.js';

/**
 * Resolve the per-request email settings shared by every default mail builder
 * from `config.email` (+ `appUrl`). Server-side and SSR-safe — no Svelte
 * context. Centralised so each handler reads the locale bundle, the resolved
 * `from` (with display name applied), and the app name the same way.
 */
export interface ResolvedEmailSettings {
  /** Localized bundle for the configured `email.locale` (English fallback). */
  t: AuthLocale;
  /** App name for the `{appName}` placeholder — `email.appName` or the `appUrl` host. */
  appName: string;
  /** `From` with any `fromName` folded in — pass straight to `email.send({ from })`. */
  from?: string;
}

/**
 * Locales already reported as unregistered. The check has to sit here, at
 * resolve time, rather than at `createAuthDeps`/`createAuthHandle` construction
 * like the other config warnings: registration order at server boot belongs to
 * the consumer, and a `locales.ts` imported after the auth setup module would
 * make a construction-time check report a slip that is not one. Kept per
 * process and per locale because this runs for every mail the package sends;
 * the `Locale` union bounds the set.
 */
const reportedUnregisteredLocales = new Set<Locale>();

/**
 * @param logger `deps.logger` — the sink `createAuthDeps` already resolved and
 * shielded. Taken as a parameter rather than read back off `config.logger`, so
 * this does not become a second place that re-defaults to `console`.
 */
export function resolveEmailSettings<R extends string>(
  config: AuthConfig<R>,
  logger: AuthLogger
): ResolvedEmailSettings {
  const email = config.email;
  const locale = email?.locale;
  if (locale && !hasAuthLocale(locale) && !reportedUnregisteredLocales.has(locale)) {
    reportedUnregisteredLocales.add(locale);
    // A wiring slip must not block a password-reset mail, so this warns and
    // sends English rather than throwing.
    logger.warn(
      `[auth] email.locale is "${locale}", but no AuthLocale bundle is registered for it — the default mails go out in English. ` +
        `Call registerAuthLocale('${locale}', bundle) at server start; the package ships bundles at '@urbicon-ui/auth/i18n/en' and '@urbicon-ui/auth/i18n/de'.`
    );
  }
  return {
    t: resolveAuthLocale(locale),
    appName: email?.appName ?? hostOf(config.appUrl),
    from: applyFromName(email?.from, email?.fromName)
  };
}

/** Best-effort host extraction from `appUrl`; falls back to the raw value. */
function hostOf(appUrl: string): string {
  try {
    return new URL(appUrl).host;
  } catch {
    return appUrl;
  }
}
