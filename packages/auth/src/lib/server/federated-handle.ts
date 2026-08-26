// Consumer side of federated identity (SSO): a SvelteKit handle for apps that
// TRUST an identity provider running this package with `jwt.algorithm:
// 'ES256'`. It verifies the IdP's session JWT against the IdP's published
// JWKS (`createJWKSHandler`) and maps the proven identity to a local user via
// the consumer's own `resolveUser`.
//
// Core principle — identity ≠ authorization: the IdP token only proves WHO the
// caller is. Whether that identity may enter this app, and as what, is decided
// HERE (by `resolveUser`), never by the token's own claims — which is why the
// IdP-internal `role`/`tokenVersion` claims are structurally withheld from the
// consumer (see {@link FederatedIdentity}).

import { type Handle, type RequestEvent, redirect } from '@sveltejs/kit';
import type { AuthLogger } from '../types.js';
import { parseDurationSeconds } from './duration.js';
import { base64UrlDecodeString } from './encoding.js';
import { authError } from './handlers/errors.js';
import { BASE64URL_REGEX, es256Verify, MAX_TOKEN_LENGTH, SESSION_TOKEN_PURPOSE } from './jwt.js';
import { shieldLogger } from './logger.js';
import { compilePublicRoutes, type PublicRoute } from './public-routes.js';

/**
 * The identity a verified IdP token proves — and NOTHING more. Deliberately
 * excludes the token's `role` and `tokenVersion` claims: both are internal to
 * the IdP application (its own role model, its own revocation counter).
 * Forwarding them here would invite the identity/authorization confusion this
 * boundary exists to prevent — a consumer app must decide access and roles
 * itself, keyed on `subject` (e.g. via a `FederatedAccountRepository` link
 * table). The object handed to `resolveUser` is constructed field-by-field
 * from this shape, so the withheld claims cannot leak through at runtime
 * either.
 */
export interface FederatedIdentity {
  /**
   * The IdP's stable user id (the token's `sub` claim). This is the key to
   * link accounts by — never the email, which a user can change at the IdP.
   */
  subject: string;
  /** The email verified/managed by the IdP at token-mint time. */
  email: string;
  /** Unix seconds the token was minted (`iat`). */
  issuedAt: number;
  /** Unix seconds the token expires (`exp`). */
  expiresAt: number;
}

export interface FederatedAuthHandleOptions<TUser> {
  /**
   * Absolute URL of the IdP's JWKS endpoint (the route where the IdP mounted
   * `createJWKSHandler`, e.g. `https://auth.example.com/.well-known/jwks.json`).
   * MUST be https — the JWKS is the trust anchor for every federated session,
   * and fetching it over plain http would let a network attacker substitute
   * keys. http is tolerated for localhost development only (with a warning);
   * anything else throws at factory time.
   */
  jwksUrl: string;
  /**
   * Name of the IdP session cookie this app receives (via `jwt.cookieDomain`
   * on the IdP, e.g. `.example.com`). Must match the IdP's `jwt.cookieName`.
   * @default 'session'
   */
  cookieName?: string;
  /**
   * Map a proven identity to this app's own user — the consumer's ENTIRE
   * authorization decision. Return the object to expose as `locals.user`, or
   * `null` to deny access (fail-closed: the request is then treated exactly
   * like an unauthenticated one). Called on every request that carries a
   * verifiable token; memoize/cache inside if your lookup is expensive. A
   * throw fails the request (mirroring `transformUser` on the IdP handle).
   *
   * Receives ONLY identity claims ({@link FederatedIdentity}) — deliberately
   * never the IdP token's `role`/`tokenVersion`.
   */
  resolveUser: (
    identity: FederatedIdentity,
    event: RequestEvent
  ) => Promise<TUser | null> | TUser | null;
  /**
   * How long a fetched JWKS document is trusted before it is re-fetched.
   * Mirrors the `max-age=300` the IdP's `createJWKSHandler` serves: five
   * minutes keeps the rotation-propagation window tight without hammering the
   * endpoint. Must be at least 1000 ms — a shorter cache would collapse the
   * anti-fetch-storm cooldown (rejected at factory time). @default 300_000
   */
  cacheTtlMs?: number;
  /**
   * Optional freshness cap on top of `exp`, as a duration string (`'15m'`,
   * `'2h'`, …): a token whose `iat` is older is rejected even when not yet
   * expired. This is the consumer-side mitigation for revocation blindness —
   * the consumer cannot see the IdP's `tokenVersion` bumps ("log out
   * everywhere"), so an IdP-revoked session stays verifiable here until `exp`.
   * A tight `maxTokenAge` bounds that window (pair it with short-lived IdP
   * access tokens via `refreshToken` rotation). Off by default.
   */
  maxTokenAge?: string;
  /**
   * Routes exempt from the guard, read exactly as the IdP handle's
   * `publicRoutes`: a string is a pathname prefix, `{ path, exact: true }` the
   * pathname alone (see {@link PublicRoute}); a bare `'/'` prefix exempts the
   * whole app and is warned about at construction. A list held in a variable
   * first needs `as const` or the annotation `PublicRoute[]`, or TypeScript
   * widens `exact: true` to `boolean`; an inline list needs nothing. Defaults
   * to `[]` — the whole app requires a resolved user — because unlike the IdP
   * this app serves no login/register pages of its own; list your genuinely
   * public pages explicitly.
   */
  publicRoutes?: readonly PublicRoute[];
  /**
   * Where to send an unauthenticated browser request (302) — typically the
   * IdP's login page, absolute URL. Deliberately used verbatim: no
   * `redirectTo` is appended, because the IdP's `sanitizeRedirect` admits
   * IdP-local paths only, so a consumer-app path would be dropped (or worse,
   * misresolved against the IdP origin). Encode your own return-URL scheme
   * into `loginUrl` if the IdP deployment supports one. When omitted, guarded
   * page requests get the same JSON 401 as API routes (fail-closed, no
   * invented default).
   */
  loginUrl?: string;
  /**
   * Same switch as on the IdP handle: allow unauthenticated SvelteKit Remote
   * Functions past the guard. Remote calls are default-denied on the
   * unspoofable `event.isRemoteRequest` (plus the no-JS `?/remote=` form
   * fallback) because their pathname is caller-controlled — see
   * `AuthHandleOptions.allowUnauthenticatedRemote` for the full rationale.
   * @default false
   */
  allowUnauthenticatedRemote?: boolean;
  /** Log sink for the JWKS fail-closed warnings. @default console */
  logger?: AuthLogger;
}

const DEFAULT_CACHE_TTL_MS = 5 * 60_000;
/**
 * Lower bound on `cacheTtlMs`. Below this the `min(REFRESH_COOLDOWN_MS,
 * cacheTtlMs)` cooldown would collapse and stop bounding unknown-kid fetches
 * (see the factory-time check). 1 s is already far shorter than any real JWKS
 * cache window.
 */
const MIN_CACHE_TTL_MS = 1_000;
/**
 * Minimum spacing between JWKS fetch attempts. An unknown `kid` triggers at
 * most ONE refresh per window — so a legitimate key rotation propagates within
 * a minute, while an attacker replaying tokens with invented kids (or hitting
 * the app during an IdP outage) cannot turn every request into an outbound
 * fetch. Capped at `cacheTtlMs` so a shorter cache TTL never starves itself.
 */
const REFRESH_COOLDOWN_MS = 60_000;
const FETCH_TIMEOUT_MS = 5_000;
/**
 * Hard cap on the accepted JWKS size. A well-run IdP serves the active key
 * plus a handful in rotation; a document beyond this is either a
 * misconfigured URL or an attacker-controlled endpoint, and is rejected
 * wholesale (fail-closed) rather than partially trusted.
 */
const MAX_JWKS_KEYS = 10;
/**
 * Hard byte ceiling on the JWKS body, enforced *while* the response streams in —
 * before `parseJwksKeys` and its key-count cap ever run. A real JWKS with ten
 * P-256 keys is a few KB; 256 KB is ~80× that. Without it, a hostile or
 * misconfigured endpoint could make the consumer buffer an arbitrarily large
 * body before the key cap fires: the fetch `AbortSignal` bounds the read in
 * wall-clock time, this bounds it in memory.
 */
const MAX_JWKS_BYTES = 256 * 1024;
const LOCALHOST_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

function validateJwksUrl(raw: string, logger: AuthLogger): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `[auth] createFederatedAuthHandle: jwksUrl must be an absolute URL (got '${raw}').`
    );
  }
  if (url.protocol === 'https:') return url;
  if (url.protocol === 'http:' && LOCALHOST_HOSTNAMES.has(url.hostname)) {
    logger.warn(
      '[auth] createFederatedAuthHandle: jwksUrl uses plain http — tolerated for localhost development only. Production must fetch the JWKS over https: it is the trust anchor for every federated session, and an http fetch would let a network attacker substitute the keys.'
    );
    return url;
  }
  throw new Error(
    '[auth] createFederatedAuthHandle: jwksUrl must be https (http is tolerated for localhost development only). The JWKS is the trust anchor for every federated session — fetching it over plain http would let a network attacker substitute the keys.'
  );
}

/**
 * Strictly parse a JWKS document into the kid → public-key map. Throws on a
 * structurally unusable document (not `{ keys: [...] }`, or oversized);
 * silently skips entries that are not public P-256 signature keys with a
 * `kid` (a mixed JWKS may legitimately carry keys for other purposes). An
 * entry carrying the private scalar `d` is discarded via `onPrivateKey` —
 * private material must never be trusted from, nor kept after, a fetch.
 */
function parseJwksKeys(
  doc: unknown,
  onPrivateKey: () => void
): Map<string, { x: string; y: string }> {
  if (doc === null || typeof doc !== 'object' || !Array.isArray((doc as { keys?: unknown }).keys)) {
    throw new Error('JWKS response is not a { keys: [...] } document');
  }
  const rawKeys = (doc as { keys: unknown[] }).keys;
  if (rawKeys.length > MAX_JWKS_KEYS) {
    throw new Error(
      `JWKS response carries ${rawKeys.length} keys (cap: ${MAX_JWKS_KEYS}) — refusing the oversized document`
    );
  }
  const keys = new Map<string, { x: string; y: string }>();
  for (const entry of rawKeys) {
    if (entry === null || typeof entry !== 'object') continue;
    const jwk = entry as {
      kty?: unknown;
      crv?: unknown;
      x?: unknown;
      y?: unknown;
      kid?: unknown;
      d?: unknown;
    };
    if (jwk.d !== undefined) {
      onPrivateKey();
      continue;
    }
    if (jwk.kty !== 'EC' || jwk.crv !== 'P-256') continue;
    if (typeof jwk.x !== 'string' || typeof jwk.y !== 'string' || typeof jwk.kid !== 'string') {
      continue;
    }
    keys.set(jwk.kid, { x: jwk.x, y: jwk.y });
  }
  return keys;
}

/**
 * Read a JWKS response body under a hard byte ceiling. A declared
 * `Content-Length` over the cap is rejected up front; a lying or absent one is
 * caught by counting bytes as the stream drains. Throws on a breach — the
 * caller turns any throw into "signed out until reachable" (fail-closed).
 */
async function readJwksBody(res: Response, maxBytes = MAX_JWKS_BYTES): Promise<string> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new Error(
      `JWKS response declares ${declared} bytes (cap: ${maxBytes}) — refusing to buffer it`
    );
  }
  const stream = res.body;
  if (!stream) {
    // No readable stream (exotic — undici/workerd always stream a non-empty
    // body): fall back to res.text(), but still enforce the byte cap on the
    // buffered result so a lying/absent Content-Length can't slip an oversized
    // body past on this path. Defense-in-depth for a branch the Content-Length
    // pre-check already guards in the honest case.
    const text = await res.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error(`JWKS response exceeds ${maxBytes} bytes — refusing to buffer it`);
    }
    return text;
  }
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        throw new Error(`JWKS response exceeds ${maxBytes} bytes — refusing to buffer it`);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/**
 * Consumer-side SvelteKit handle for apps that trust a federated identity
 * provider running this package with `jwt.algorithm: 'ES256'` — the
 * counterpart of the IdP's `createJWKSHandler`. Per request it reads the IdP
 * session cookie, verifies the ES256 JWT against the IdP's JWKS (fetched
 * lazily, cached per `cacheTtlMs`), hands the proven identity to
 * `resolveUser`, exposes the result as `event.locals.user` (same locals
 * contract as `createAuthHandle`), and guards routes: unauthenticated remote
 * requests are default-denied, `/api/` routes get a JSON 401, pages redirect
 * to `loginUrl` (when set) — `publicRoutes` are exempt.
 *
 * **Identity ≠ authorization.** The token proves who the caller is; this app
 * decides — in `resolveUser` — whether that identity gets in and as what.
 * `resolveUser` receives identity claims only ({@link FederatedIdentity});
 * the IdP token's `role`/`tokenVersion` are IdP-internal and never forwarded.
 * `resolveUser` returning `null` denies access (fail-closed).
 *
 * **ES256 only.** A federated consumer verifies asymmetrically; the token
 * header's `alg` must be `'ES256'` or the token is rejected. There is no
 * legitimate HS256 federation setup — verifying HS256 requires the signing
 * secret, and a shared signing secret means every "consumer" can MINT tokens,
 * i.e. there is no trust boundary left to federate across.
 *
 * **Fail-closed JWKS handling.** The JWKS fetch is lazy (first verification)
 * and cached; an unknown `kid` triggers at most one refresh per cooldown
 * window (no fetch storms from invented kids); a failed/timed-out/malformed/
 * oversized fetch logs one loud error and treats affected sessions as signed
 * out — never a 500. Keys carrying private material are discarded.
 *
 * **This handle never writes cookies.** The session cookie belongs to the
 * IdP (which sets it for the shared parent domain via `jwt.cookieDomain`);
 * login and logout happen there. Consequently there is no refresh-token
 * rotation here either — rotation is IdP-internal. This handle also adds no
 * CSRF gate of its own (keep SvelteKit's kernel CSRF gate on — the default;
 * don't set `trustedOrigins: ['*']` on a federated consumer: there is no
 * `validateCsrf` backstop behind this handle. If you must expose a
 * header-less cross-origin endpoint, gate cookie-authenticated mutations
 * yourself via the exported `validateCsrf` first — docs/AUTH.md → Federated)
 * and no security headers (they are this app's own policy, not the
 * IdP's) — it does exactly one thing: turn the IdP cookie into
 * `locals.user`, or into a guarded 401/redirect.
 *
 * Revocation caveat: the consumer cannot see the IdP's `tokenVersion` ("log
 * out everywhere"), so an IdP-revoked session stays verifiable here until
 * `exp`. Keep IdP access tokens short-lived and/or set `maxTokenAge`.
 */
export function createFederatedAuthHandle<TUser>(
  options: FederatedAuthHandleOptions<TUser>
): Handle {
  const logger = shieldLogger(options.logger ?? console);
  const jwksUrl = validateJwksUrl(options.jwksUrl, logger);
  const cookieName = options.cookieName ?? 'session';
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  // Floor, not just `> 0`: the anti-storm cooldown is `min(REFRESH_COOLDOWN_MS,
  // cacheTtlMs)`, so a sub-second cacheTtlMs would collapse it toward zero and
  // let unknown-kid requests trigger an outbound JWKS fetch each — a self-DoS
  // on both ends. Flooring the cooldown *above* cacheTtlMs instead would strand
  // legitimate short-TTL configs (stale-but-uncooled window), so the honest
  // lever is rejecting the absurd TTL at wiring time. 1 s is already far below
  // any sane JWKS cache (the default is five minutes).
  if (!(cacheTtlMs >= MIN_CACHE_TTL_MS)) {
    throw new Error(
      `[auth] createFederatedAuthHandle: cacheTtlMs must be at least ${MIN_CACHE_TTL_MS} ms (a shorter cache would collapse the anti-fetch-storm cooldown). The default is ${DEFAULT_CACHE_TTL_MS} ms.`
    );
  }
  const refreshCooldownMs = Math.min(REFRESH_COOLDOWN_MS, cacheTtlMs);
  // parseDurationSeconds throws on a malformed duration — at factory time,
  // where the typo is fixable, not per request.
  const maxTokenAgeSeconds =
    options.maxTokenAge !== undefined ? parseDurationSeconds(options.maxTokenAge) : undefined;
  const isPublicPath = compilePublicRoutes(options.publicRoutes ?? [], logger);
  const allowUnauthenticatedRemote = options.allowUnauthenticatedRemote ?? false;
  const loginUrl = options.loginUrl;

  // ---- JWKS cache (per handle instance) ----
  let cache: { keys: Map<string, { x: string; y: string }>; fetchedAt: number } | null = null;
  let lastAttemptAt = 0;
  let inflight: Promise<void> | null = null;

  // Loud but not spammy: each failure category warns once — re-armed by the
  // next successful fetch, so a NEW outage after recovery is heard again.
  const warned = new Set<string>();
  const warnOnce = (category: string, message: string, ...context: unknown[]) => {
    if (warned.has(category)) return;
    warned.add(category);
    logger.error(message, ...context);
  };

  const isFresh = () => cache !== null && Date.now() - cache.fetchedAt < cacheTtlMs;

  const refresh = (): Promise<void> => {
    // A fetch already underway serves every concurrent verification — the
    // dedup is what keeps N parallel first-requests at one outbound fetch.
    if (inflight) return inflight;
    if (Date.now() - lastAttemptAt < refreshCooldownMs) return Promise.resolve();
    lastAttemptAt = Date.now();
    inflight = (async () => {
      try {
        const res = await fetch(jwksUrl.href, {
          // Do not follow redirects: a compromised-but-redirecting endpoint
          // (302, including https→http) must not be able to relocate the trust
          // anchor away from the configured https origin.
          redirect: 'error',
          signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)
        });
        if (!res.ok) throw new Error(`JWKS endpoint answered ${res.status}`);
        const keys = parseJwksKeys(JSON.parse(await readJwksBody(res)), () =>
          warnOnce(
            'private-key',
            `[auth] createFederatedAuthHandle: the JWKS at ${jwksUrl.href} served a key carrying the private scalar \`d\` — the key was discarded. The IdP is leaking private key material; rotate that key immediately.`
          )
        );
        cache = { keys, fetchedAt: Date.now() };
        warned.delete('jwks-fetch');
      } catch (err) {
        // Fail closed, not 500: sessions depending on this fetch are treated
        // as signed out until the key set is reachable again.
        warnOnce(
          'jwks-fetch',
          `[auth] createFederatedAuthHandle: could not load the JWKS from ${jwksUrl.href} — federated sessions fail closed (treated as signed out) until the key set is reachable.`,
          err
        );
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  };

  const getVerificationKey = async (kid: string): Promise<{ x: string; y: string } | null> => {
    if (!isFresh()) await refresh();
    // Still stale ⇒ the fetch failed or is cooldown-gated — fail closed
    // rather than trusting keys past their TTL (removal from the JWKS is the
    // IdP's only key-revocation mechanism; serving stale would undo it).
    if (!isFresh()) return null;
    const hit = cache?.keys.get(kid);
    if (hit) return hit;
    // Unknown kid on a fresh cache: the one legitimate cause is a key
    // rotation newer than the cache, so allow exactly one refresh — the
    // cooldown inside refresh() is what stops invented kids from causing a
    // fetch storm.
    await refresh();
    if (!isFresh()) return null;
    return cache?.keys.get(kid) ?? null;
  };

  /**
   * Verify the raw cookie value and project it down to identity claims.
   * Mirrors `verifySessionToken`'s fail-closed shape checks — including the
   * input length cap and the mandatory `purpose: 'session'` binding — with
   * two consumer-side differences: the algorithm is pinned to ES256 (see the
   * factory JSDoc), and a `kid` header is REQUIRED — the IdP's ES256 tokens
   * always carry one, so a kid-less token can only be foreign (and rejecting
   * it before key lookup means it cannot trigger a JWKS fetch either).
   */
  const verifyIdpToken = async (token: string): Promise<FederatedIdentity | null> => {
    // Length cap before ANY parsing (see MAX_TOKEN_LENGTH in jwt.ts) — an
    // oversized cookie is rejected before it can trigger a JWKS fetch.
    if (token.length > MAX_TOKEN_LENGTH) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;
    const [header, body, signature] = parts;

    let kid: string;
    try {
      const headerJson = JSON.parse(base64UrlDecodeString(header));
      if (headerJson.alg !== 'ES256') return null;
      if (typeof headerJson.kid !== 'string') return null;
      kid = headerJson.kid;
    } catch {
      return null;
    }

    const key = await getVerificationKey(kid);
    if (!key) return null;

    let valid = false;
    try {
      valid = await es256Verify(`${header}.${body}`, signature, key);
    } catch {
      // Malformed key material from the JWKS — fail closed.
    }
    if (!valid) return null;

    try {
      const payload = JSON.parse(base64UrlDecodeString(body));
      const now = Math.floor(Date.now() / 1000);
      // exp is mandatory and must be in date; iat is mandatory (the IdP
      // always stamps it) and feeds the optional freshness cap.
      if (typeof payload.exp !== 'number' || payload.exp < now) return null;
      if (typeof payload.iat !== 'number') return null;
      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') return null;
      // Purpose binding, consistent across the app boundary: only a token the
      // IdP minted AS A SESSION token may federate — the claim value is the
      // shared SESSION_TOKEN_PURPOSE import, so IdP mint and consumer verify
      // cannot drift. A signature-valid ES256 token stamped for any other
      // purpose (or none — e.g. minted by a pre-purpose IdP version) fails
      // closed here; upgrade order is IdP first (see docs/AUTH.md → Federated
      // Identity → version skew).
      if (payload.purpose !== SESSION_TOKEN_PURPOSE) return null;
      if (maxTokenAgeSeconds !== undefined && now - payload.iat > maxTokenAgeSeconds) return null;
      // Identity claims ONLY, constructed field-by-field — the token's
      // role/tv (IdP-internal authorization data) are structurally unable to
      // reach resolveUser (see FederatedIdentity).
      return {
        subject: payload.sub,
        email: payload.email,
        issuedAt: payload.iat,
        expiresAt: payload.exp
      };
    } catch {
      return null;
    }
  };

  return async ({ event, resolve }) => {
    // 1. IdP session cookie → verified identity → the consumer's own user.
    const token = event.cookies.get(cookieName);
    let user: TUser | null = null;
    if (token) {
      const identity = await verifyIdpToken(token);
      if (identity) {
        // resolveUser IS the authorization decision; null denies (fail-closed).
        user = (await options.resolveUser(identity, event)) ?? null;
      }
    }
    (event.locals as Record<string, unknown>).user = user;

    // 2. Route guard — the same two-transport remote-function default-deny as
    // createAuthHandle (issue #43: the pathname is caller-controlled for both
    // transports, so neither may be gated on the path).
    const isRemoteFormPost =
      event.request.method === 'POST' && Boolean(event.url.searchParams.get('/remote'));

    if (event.isRemoteRequest || isRemoteFormPost) {
      if (!user && !allowUnauthenticatedRemote) {
        return authError('not_authenticated', 401);
      }
    } else {
      if (!user && !isPublicPath(event.url.pathname)) {
        if (!loginUrl || event.url.pathname.startsWith('/api/')) {
          return authError('not_authenticated', 401);
        }
        // Verbatim, no redirectTo — see FederatedAuthHandleOptions.loginUrl.
        throw redirect(302, loginUrl);
      }
    }

    return resolve(event);
  };
}
