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
  return { ok: res.ok, data: await parseJsonBody(res) };
}

/**
 * GET a JSON resource with the same tolerant body handling as {@link postJson}.
 * No CSRF header — reads are not state-changing; the optional `fetcher` keeps
 * mock backends and custom retry layers injectable (review R18).
 */
export async function getJson(
  url: string,
  options?: { fetcher?: typeof globalThis.fetch }
): Promise<JsonResult> {
  const res = options?.fetcher ? await options.fetcher(url) : await fetch(url);
  return { ok: res.ok, data: await parseJsonBody(res) };
}

/**
 * Tolerantly parse a response body: shields unparseable bodies AND non-object
 * JSON (`null`, arrays, strings — e.g. a proxy error page with a JSON content
 * type). Without it the cast would let `data.code` throw inside the caller's
 * error path, turning a failed request into a hung busy state instead of an
 * error message. Exported for callers that hold a raw `Response` (DELETEs).
 */
export async function parseJsonBody(res: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await res.json().catch(() => ({}));
  return (
    typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? parsed : {}
  ) as Record<string, unknown>;
}

/**
 * Narrow the wire-contract fields (`{ error, code }`) out of a tolerant-parsed
 * body — anything non-string (and the information-free empty string) becomes
 * `undefined` instead of leaking through.
 */
export function wireError(data: Record<string, unknown>): { error?: string; code?: string } {
  return {
    error: typeof data.error === 'string' && data.error !== '' ? data.error : undefined,
    code: typeof data.code === 'string' && data.code !== '' ? data.code : undefined
  };
}

/**
 * Localized error text for an auth error body: the machine `code` maps
 * through the locale bundle, an unknown code falls back to the server's
 * English prose, and a body with neither yields the generic message. An empty
 * `error` string counts as absent — it must not defeat the generic fallback
 * and leave the error region blank.
 *
 * NOT a package export: the unguarded `t.common.error` read is safe only
 * because every caller resolves `t` through `mergeAuthLocale`. If this is
 * ever exported, give it the same read-tolerance as `errorMessageFromCode`.
 */
export function errorTextFromBody(data: Record<string, unknown>, t: AuthLocale): string {
  const code = typeof data.code === 'string' ? data.code : undefined;
  const prose = typeof data.error === 'string' && data.error !== '' ? data.error : undefined;
  return errorMessageFromCode(code, t, prose) ?? t.common.error;
}
