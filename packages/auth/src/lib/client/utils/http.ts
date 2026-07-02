import type { AuthLocale } from '../../i18n/keys.js';
import type { CsrfClientOptions } from '../csrf.js';
import { csrfFetch } from '../csrf.js';
import { errorMessageFromCode } from './error-message.js';

/** Result of a JSON API call: HTTP ok-flag + parsed body (`{}` when the body wasn't JSON). */
export interface JsonResult {
  ok: boolean;
  data: Record<string, unknown>;
}

/**
 * POST a JSON body through the package's CSRF/fetcher plumbing and parse the
 * response tolerantly — the shared request core of the manager components
 * (was copied verbatim per component, review R14).
 */
export async function postJson(
  url: string,
  body: unknown,
  options?: { csrf?: CsrfClientOptions; fetcher?: typeof globalThis.fetch }
): Promise<JsonResult> {
  const res = await csrfFetch(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    },
    options?.csrf,
    options?.fetcher
  );
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, data };
}

/**
 * Localized error text for an auth error body: the machine `code` maps
 * through the locale bundle, an unknown code falls back to the server's
 * English prose, and a body with neither yields the generic message.
 */
export function errorTextFromBody(data: Record<string, unknown>, t: AuthLocale): string {
  const code = typeof data.code === 'string' ? data.code : undefined;
  const prose = typeof data.error === 'string' ? data.error : undefined;
  return errorMessageFromCode(code, t, prose) ?? t.common?.error ?? 'An error occurred';
}
