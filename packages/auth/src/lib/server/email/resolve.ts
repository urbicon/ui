import { resolveAuthLocale } from '../../i18n/index.js';
import type { AuthLocale } from '../../i18n/keys.js';
import type { AuthConfig } from '../../types.js';
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

export function resolveEmailSettings<R extends string>(
  config: AuthConfig<R>
): ResolvedEmailSettings {
  const email = config.email;
  return {
    t: resolveAuthLocale(email?.locale),
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
