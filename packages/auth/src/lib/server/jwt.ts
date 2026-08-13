// Session JWTs on Web Crypto — HS256 (default) or ES256, with key rotation via
// `kid` / `previousSecrets` / `previousPublicKeys` — plus the generic
// short-lived signed token (pending-2FA handle etc.), which stays HMAC-based
// under every algorithm. Split out of the former auth.ts god-file.

import type {
  AuthLogger,
  AuthSession,
  Es256PrivateJwk,
  Es256PublicJwk,
  JwtConfig
} from '../types.js';
import { parseDurationSeconds } from './duration.js';
import {
  base64UrlDecode,
  base64UrlDecodeString,
  base64UrlEncode,
  base64UrlEncodeString,
  toArrayBuffer
} from './encoding.js';
import { timingSafeEqual } from './timing-safe.js';

// Internal export: shared with the federated consumer handle
// (federated-handle.ts) so token-shape validation cannot drift between the
// IdP verify path and the consumer verify path. Not part of the public API.
export const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

/**
 * The `purpose` claim stamped into every session token (HS256 and ES256
 * alike) and REQUIRED by `verifySessionToken` and the federated consumer
 * handle (`createFederatedAuthHandle`). Purpose binding lives in the
 * primitive, not in each caller's claim-shape check: two token kinds signed
 * with the same `jwt.secret` (a session token and, say, the pending-2FA
 * handle) can never be accepted for each other's purpose, whatever claims
 * they carry. The value is wire contract across app boundaries (IdP ↔
 * federated consumers) — never change it without upgrading both sides
 * (IdP first; see docs/AUTH.md → Federated Identity).
 */
export const SESSION_TOKEN_PURPOSE = 'session';

/**
 * Hard input-length cap applied by `verifySessionToken`, `verifySignedToken`
 * and the federated consumer handle BEFORE any splitting or parsing. Tokens
 * this package mints are well under 1 KB, and browsers cap a cookie at ~4 KB
 * (RFC 6265 minimum) — so 8 KB, double the cookie ceiling, can never reject a
 * legitimate cookie-borne token while keeping adversarial input finite for a
 * consumer that applies these verifiers to unbounded non-cookie input
 * (headers, request bodies). Belt-and-suspenders: the parse path is linear
 * and early-rejecting even without it.
 */
export const MAX_TOKEN_LENGTH = 8192;

/**
 * A missing/empty `purpose` is API misuse (a programming error), not a bad
 * token: fail loud instead of silently verifying purposeless — that would
 * reopen the cross-purpose acceptance the parameter exists to close.
 */
function requireValidPurpose(purpose: string, fn: string): void {
  if (typeof purpose !== 'string' || purpose.length === 0) {
    throw new Error(
      `[auth] ${fn}: purpose must be a non-empty string (e.g. '2fa-pending') — it is stamped into the token at mint and required verbatim at verify.`
    );
  }
}

async function hmacSign(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return base64UrlEncode(new Uint8Array(signature));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const expected = await hmacSign(payload, secret);
  if (expected.length !== signature.length) return false;
  const encoder = new TextEncoder();
  const a = encoder.encode(expected);
  const b = encoder.encode(signature);
  return timingSafeEqual(a, b);
}

// ---- ES256 (ECDSA P-256) ----
//
// Web Crypto ECDSA signatures are the raw `r‖s` concatenation (64 bytes for
// P-256) — exactly the JWS ES256 wire format, so sign/verify need no format
// conversion. (`ecdsa-der.ts` exists solely for WebAuthn authenticators, which
// DO emit DER — it has no business here.)

const ES256_KEY_PARAMS = { name: 'ECDSA', namedCurve: 'P-256' } as const;
const ES256_SIGN_PARAMS = { name: 'ECDSA', hash: 'SHA-256' } as const;

async function es256Sign(payload: string, signingKey: Es256PrivateJwk): Promise<string> {
  // Import from an explicitly constructed JWK: consumer-provided keys may
  // carry `use`/`key_ops`/`alg` members that conflict with the requested
  // usage and make importKey reject an otherwise fine key.
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: signingKey.x, y: signingKey.y, d: signingKey.d },
    ES256_KEY_PARAMS,
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign(
    ES256_SIGN_PARAMS,
    key,
    new TextEncoder().encode(payload)
  );
  return base64UrlEncode(new Uint8Array(signature));
}

// Internal export: the one ES256 verify primitive, shared with the federated
// consumer handle (federated-handle.ts) so the signature check cannot drift
// between the IdP verify path and the consumer verify path. Not part of the
// public API (server/index.ts does not re-export it).
export async function es256Verify(
  payload: string,
  signature: string,
  publicKey: { x?: string; y?: string }
): Promise<boolean> {
  const sig = base64UrlDecode(signature);
  // JWS ES256 signatures are exactly raw r‖s = 64 bytes; anything else can
  // only be malformed (e.g. a DER-encoded signature) — reject before touching
  // key material.
  if (sig.length !== 64) return false;
  // Public members only: an entry that mistakenly carries the private `d`
  // (say, a full private JWK pasted into previousPublicKeys) would make
  // importKey reject the 'verify' usage — stripping to x/y keeps verification
  // working and never handles private material on the verify path.
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: publicKey.x, y: publicKey.y },
    ES256_KEY_PARAMS,
    false,
    ['verify']
  );
  return crypto.subtle.verify(
    ES256_SIGN_PARAMS,
    key,
    toArrayBuffer(sig),
    new TextEncoder().encode(payload)
  );
}

/**
 * RFC 7638 JWK thumbprint of a P-256 key: SHA-256 over the canonical JSON of
 * the required public members (`crv`, `kty`, `x`, `y` in lexicographic order,
 * no whitespace), base64url-encoded. Deterministic — the same key always maps
 * to the same value, and private and public JWK of one pair agree (only public
 * members feed the hash). This is the default `kid` for ES256 session tokens
 * and for the keys served by `createJWKSHandler`; use it to derive the `kid`
 * of a retiring key when building `previousPublicKeys` by hand.
 */
export async function computeJwkThumbprint(jwk: JsonWebKey): Promise<string> {
  if (jwk.kty !== 'EC' || !jwk.crv || !jwk.x || !jwk.y) {
    throw new Error('[auth] computeJwkThumbprint: expected an EC JWK with crv, x and y.');
  }
  // Insertion order IS the RFC 7638 lexicographic order for EC keys.
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return base64UrlEncode(new Uint8Array(digest));
}

/**
 * Generate a fresh ES256 (ECDSA P-256) key pair for `jwt.algorithm: 'ES256'`,
 * as JWKs ready for the config: `privateKey` goes into `jwt.signingKey` (keep
 * it secret); `publicKey` is what `createJWKSHandler` serves for it and what a
 * retiring key contributes to `jwt.previousPublicKeys`. Both JWKs are stamped
 * with the same `kid` — the RFC 7638 SHA-256 thumbprint, deterministic for the
 * key, so recomputing it later always yields the same id.
 *
 * Run this once in a setup script and store the result in your secret manager
 * — never on boot: a fresh key per process would invalidate every live
 * session and desynchronize the JWKS consumers rely on.
 */
export async function generateES256KeyPair(): Promise<{
  privateKey: Es256PrivateJwk;
  publicKey: Es256PublicJwk;
  kid: string;
}> {
  const pair = await crypto.subtle.generateKey(ES256_KEY_PARAMS, true, ['sign', 'verify']);
  const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  const kid = await computeJwkThumbprint(publicJwk);
  return {
    privateKey: { ...privateJwk, kid },
    publicKey: { ...publicJwk, kid } as Es256PublicJwk,
    kid
  };
}

/**
 * The `kid` stamped into new ES256 session tokens and used for the active key
 * in the JWKS document — one resolution shared by `createSessionToken` and
 * `createJWKSHandler` so the two can never drift: `keyId` when configured,
 * else the signingKey's own `kid` (stamped by {@link generateES256KeyPair}),
 * else the RFC 7638 thumbprint computed on the fly (identical to the stamped
 * value for generated keys).
 */
export async function resolveActiveKid(config: JwtConfig): Promise<string> {
  if (config.keyId) return config.keyId;
  if (!config.signingKey) {
    throw new Error('[auth] resolveActiveKid: jwt.signingKey is required for ES256.');
  }
  return config.signingKey.kid ?? computeJwkThumbprint(config.signingKey);
}

function requireSigningKey(config: JwtConfig): Es256PrivateJwk {
  if (!config.signingKey) {
    // Normally caught at wiring time by assertJwtConfigValid (createAuthDeps /
    // createAuthHandle); re-checked here so a hand-wired call path fails with
    // a clear message instead of an importKey TypeError.
    throw new Error(
      '[auth] jwt.algorithm is "ES256" but jwt.signingKey is missing — generate one with generateES256KeyPair().'
    );
  }
  return config.signingKey;
}

/**
 * Warn-once bookkeeping, keyed on the CONFIG OBJECT's identity (not
 * module-global flags): a second misconfigured config in the same process
 * warns for itself instead of being silenced by the first one's flag, while
 * the usual repeat calls over one config (createAuthDeps + createAuthHandle,
 * per-request verifies) still log once. WeakMap, so a dropped config releases
 * its entry. The sink call is shielded per the {@link AuthLogger} contract —
 * a broken logging transport must never break (or un-fail-close) the auth
 * path it observes. Observability only: every caller stays fail-closed
 * regardless of what is or isn't logged.
 */
const warnedPerConfig = new WeakMap<JwtConfig, Set<string>>();

function warnOncePerConfig(
  config: JwtConfig,
  logger: AuthLogger,
  category: string,
  message: string,
  ...context: unknown[]
): void {
  let seen = warnedPerConfig.get(config);
  if (!seen) {
    seen = new Set();
    warnedPerConfig.set(config, seen);
  }
  if (seen.has(category)) return;
  seen.add(category);
  try {
    logger.error(message, ...context);
  } catch {
    // Broken sink — swallowed (same shield as deps.ts' shieldLogger, which
    // cannot be imported here without a module cycle).
  }
}

/**
 * Fail loud at wiring time on an unusable JWT config — same posture as
 * `assertReposMatchConfig`, and called from the same two entry points
 * (`createAuthDeps` and `createAuthHandle`) so neither path can silently mint
 * dead tokens:
 *
 * - `algorithm: 'ES256'` without a usable private P-256 `signingKey` → throw
 *   (every later login would throw at sign time anyway — surface it at
 *   construction instead).
 * - a `previousPublicKeys` entry that is not a public P-256 JWK with a `kid`
 *   → throw (verification selects by `kid`; an entry without one is dead
 *   config that silently fails to verify the tokens it was added for).
 * - a `previousPublicKeys` entry carrying the private scalar `d` → loud
 *   error-level warning, once: only public members are ever used or
 *   published, but private key material does not belong in a public-key list.
 * - `signingKey`/`previousPublicKeys` set while `algorithm` is not `'ES256'`
 *   → loud error-level warning, once: the keys are ignored and sessions stay
 *   HMAC-signed, which almost certainly means `algorithm: 'ES256'` was
 *   forgotten.
 */
export function assertJwtConfigValid(config: JwtConfig, logger: AuthLogger = console): void {
  // Algorithm-independent: a `__Host-`-prefixed cookie name and a cookieDomain
  // are mutually exclusive — a browser rejects a `__Host-` cookie that carries a
  // Domain attribute, so the session cookie would silently never be set.
  // session.ts throws on this too, but only when the first login writes the
  // cookie; catch it here at wiring time like every other JWT misconfig.
  if (config.cookieDomain && (config.cookieName ?? 'session').startsWith('__Host-')) {
    throw new Error(
      '[auth] jwt.cookieDomain cannot be combined with a "__Host-"-prefixed jwt.cookieName — a browser rejects a __Host- cookie that carries a Domain attribute, so the session cookie would silently never be set.'
    );
  }
  if ((config.algorithm ?? 'HS256') === 'ES256') {
    const key = config.signingKey;
    if (!key) {
      throw new Error(
        '[auth] jwt.algorithm is "ES256" but jwt.signingKey is missing. Generate a key pair with generateES256KeyPair() and pass its privateKey — or drop `algorithm` to stay on HS256.'
      );
    }
    if (key.kty !== 'EC' || key.crv !== 'P-256' || !key.x || !key.y || !key.d) {
      throw new Error(
        '[auth] jwt.signingKey must be a PRIVATE P-256 JWK (kty "EC", crv "P-256", with x, y and the private scalar d). Generate one with generateES256KeyPair().'
      );
    }
    for (const prev of config.previousPublicKeys ?? []) {
      if (prev.kty !== 'EC' || prev.crv !== 'P-256' || !prev.x || !prev.y || !prev.kid) {
        throw new Error(
          '[auth] every jwt.previousPublicKeys entry must be a public P-256 JWK with a kid (kty "EC", crv "P-256", x, y, kid) — verification and the JWKS endpoint select keys by kid.'
        );
      }
      if (prev.d) {
        warnOncePerConfig(
          config,
          logger,
          'private-in-previous',
          '[auth] a jwt.previousPublicKeys entry carries the private scalar `d`. Only its public members are used and published, but private key material does not belong in a public-key list — replace the entry with the public JWK.'
        );
      }
    }
    // The active kid is resolved at runtime by resolveActiveKid, which falls
    // back to the JWK thumbprint when neither keyId nor the signing key's kid
    // is set. That thumbprint is async and not known here — so if it were the
    // active kid, a previousPublicKeys entry whose kid happened to equal it
    // would slip past the duplicate-kid guard below (and then shadow the active
    // key in the served JWKS, failing fresh sessions at consumers). Require an
    // explicit id in that one ambiguous case so the guard can actually see the
    // active kid. Generated keys always carry a kid (generateES256KeyPair), so
    // this only bites a hand-built kid-less key paired with a rotation list.
    if (!config.keyId && !key.kid && (config.previousPublicKeys?.length ?? 0) > 0) {
      throw new Error(
        '[auth] jwt.keyId is required when jwt.previousPublicKeys is set and the signing key carries no kid: the active key id would otherwise be a runtime-computed thumbprint that cannot be checked for collisions against the previous keys at wiring time. Set jwt.keyId, or stamp a kid on the signing key (generateES256KeyPair does both).'
      );
    }
    // Every published kid must be unique. createJWKSHandler serves the active
    // key and each previousPublicKeys entry under its own kid, and the
    // consumer's JWKS parser keeps the LAST entry per kid — so two entries
    // sharing a kid silently shadow one key, and every token signed by the
    // shadowed key then fails to verify at consumers. Only reachable via a
    // hand-set keyId or a hand-built rotation list (generated thumbprint kids
    // don't collide across distinct keys); fail loud at wiring time.
    const activeKid = config.keyId ?? key.kid;
    const seenKids = new Set<string>();
    for (const kid of [
      ...(activeKid ? [activeKid] : []),
      ...(config.previousPublicKeys ?? []).map((prev) => prev.kid as string)
    ]) {
      if (seenKids.has(kid)) {
        throw new Error(
          `[auth] duplicate JWT key id "${kid}" — the active key and every jwt.previousPublicKeys entry must carry a unique kid, or one key shadows another and its tokens fail verification at consumers.`
        );
      }
      seenKids.add(kid);
    }
  } else if (config.signingKey || config.previousPublicKeys) {
    warnOncePerConfig(
      config,
      logger,
      'es256-ignored',
      '[auth] jwt.signingKey / jwt.previousPublicKeys are set but jwt.algorithm is not "ES256" — they are ignored and sessions stay HMAC-signed (HS256). Set jwt.algorithm: "ES256" to activate the key.'
    );
  }
}

export async function createSessionToken<R extends string>(
  payload: AuthSession<R>,
  config: JwtConfig
): Promise<string> {
  const algorithm = config.algorithm ?? 'HS256';
  // ES256 tokens always carry the active kid (JWKS consumers resolve the
  // matching key by it); the HS256 branch keeps the existing
  // kid-only-when-configured header byte-identical for current consumers.
  const header = base64UrlEncodeString(
    JSON.stringify(
      algorithm === 'ES256'
        ? { alg: 'ES256', typ: 'JWT', kid: await resolveActiveKid(config) }
        : { alg: 'HS256', typ: 'JWT', ...(config.keyId ? { kid: config.keyId } : {}) }
    )
  );
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDurationSeconds(config.expiresIn ?? '7d');

  const body = base64UrlEncodeString(
    JSON.stringify({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      tv: payload.tokenVersion,
      // Purpose binding: verifySessionToken AND the federated consumer handle
      // require exactly this claim — see SESSION_TOKEN_PURPOSE.
      purpose: SESSION_TOKEN_PURPOSE,
      iat: now,
      exp
    })
  );

  const signingInput = `${header}.${body}`;
  const signature =
    algorithm === 'ES256'
      ? await es256Sign(signingInput, requireSigningKey(config))
      : await hmacSign(signingInput, config.secret);
  return `${signingInput}.${signature}`;
}

/**
 * Resolve which secrets to try against a token with the given `kid`:
 * - No `kid` header → try primary plus every previous secret (back-compat).
 * - `kid` present → try every secret whose `keyId` matches, in order
 *   (primary first, then previousSecrets). An unmatched `kid` returns no
 *   candidates so verification fails closed instead of silently falling
 *   back to arbitrary unkeyed secrets (which would give attackers an
 *   oracle to probe retired keys).
 */
function selectVerifySecrets(config: JwtConfig, tokenKid: string | undefined): string[] {
  const candidates: Array<{ secret: string; keyId?: string }> = [
    { secret: config.secret, keyId: config.keyId },
    ...(config.previousSecrets ?? [])
  ];

  if (!tokenKid) return candidates.map((c) => c.secret);
  return candidates.filter((c) => c.keyId === tokenKid).map((c) => c.secret);
}

/**
 * ES256 mirror of {@link selectVerifySecrets}: resolve which public keys to
 * try against a token with the given `kid` — the active signing key's public
 * half plus every `previousPublicKeys` entry. No `kid` header → try all
 * (tolerant towards externally minted kid-less tokens; our own ES256 tokens
 * always carry one); `kid` present → only keys with exactly that kid, so an
 * unmatched kid yields no candidates and verification fails closed — the same
 * no-silent-fallback rationale as the HMAC side.
 */
async function selectVerifyPublicKeys(
  config: JwtConfig,
  tokenKid: string | undefined
): Promise<Array<{ kid?: string; x?: string; y?: string }>> {
  const candidates: Array<{ kid?: string; x?: string; y?: string }> = [];
  if (config.signingKey) {
    candidates.push({
      kid: await resolveActiveKid(config),
      x: config.signingKey.x,
      y: config.signingKey.y
    });
  }
  for (const key of config.previousPublicKeys ?? []) {
    candidates.push({ kid: key.kid, x: key.x, y: key.y });
  }
  if (!tokenKid) return candidates;
  return candidates.filter((c) => c.kid === tokenKid);
}

export async function verifySessionToken<R extends string>(
  token: string,
  config: JwtConfig,
  logger: AuthLogger = console
): Promise<AuthSession<R> | null> {
  // Length cap before ANY parsing — see MAX_TOKEN_LENGTH.
  if (token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;

  const [header, body, signature] = parts;
  const algorithm = config.algorithm ?? 'HS256';

  // Algorithm-confusion hardening: the algorithm is pinned FROM THE CONFIG —
  // the token header only gets to confirm it, never to choose. A header `alg`
  // that differs from the configured one (e.g. an attacker re-signing an
  // ES256 payload as HS256 with the public JWK guessed as the HMAC secret) is
  // rejected before any key material is touched; an unparseable header cannot
  // confirm anything and is rejected the same way (fail-closed).
  let tokenKid: string | undefined;
  try {
    const headerJson = JSON.parse(base64UrlDecodeString(header));
    if (headerJson.alg !== algorithm) return null;
    if (typeof headerJson.kid === 'string') tokenKid = headerJson.kid;
  } catch {
    return null;
  }

  // Iterate every candidate without early break: a timing oracle that reveals
  // which key matched (primary vs a previous one) would let an attacker
  // target sessions still signed by a compromised retired key. A candidate
  // whose import fails (malformed key material) simply never sets `valid`, so
  // the all-errored case falls through the `!valid` bail below (fail-closed).
  let valid = false;
  if (algorithm === 'ES256') {
    for (const publicKey of await selectVerifyPublicKeys(config, tokenKid)) {
      try {
        if (await es256Verify(`${header}.${body}`, signature, publicKey)) valid = true;
      } catch (err) {
        warnOncePerConfig(
          config,
          logger,
          'public-key-import',
          '[auth] verifySessionToken: public key import failed — check config.signingKey / config.previousPublicKeys.',
          err
        );
      }
    }
  } else {
    for (const secret of selectVerifySecrets(config, tokenKid)) {
      try {
        if (await hmacVerify(`${header}.${body}`, signature, secret)) valid = true;
      } catch (err) {
        // A crypto.subtle.importKey rejection means the config has a malformed
        // secret (empty string, non-string). Don't mask as "no session" forever
        // — warn loudly (once per config) so consumers notice the broken
        // previousSecrets.
        warnOncePerConfig(
          config,
          logger,
          'secret-import',
          '[auth] verifySessionToken: secret import failed — check config.secret / config.previousSecrets.',
          err
        );
      }
    }
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeString(body));
    // exp is mandatory: a missing/non-numeric exp would otherwise be treated
    // as "never expires", giving anyone in possession of a (current or
    // retired) signing secret an unbounded forge window.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    // Purpose binding: only a token MINTED as a session token may open a
    // session — a signature-valid token stamped for another purpose (e.g. a
    // pending-2FA handle signed with the same jwt.secret) is rejected here in
    // the primitive, before its claim shape gets a say. Missing claim (a token
    // minted by a pre-purpose package version) fails closed the same way.
    if (payload.purpose !== SESSION_TOKEN_PURPOSE) {
      return null;
    }
    // Validate the claim shape even though the signature already matched: a
    // token minted with a missing/wrong-typed claim (e.g. no `sub`, a numeric
    // `role`) must not flow into the app as `userId: undefined` /
    // `role: <number>` where downstream guards (findById, role checks) would
    // behave unpredictably. Fail closed instead.
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.tv !== 'number'
    ) {
      return null;
    }
    return {
      userId: payload.sub,
      email: payload.email,
      role: payload.role as R,
      tokenVersion: payload.tv
    };
  } catch {
    // Body decode/parse failure on an otherwise signature-valid token: treat
    // as broken but not as a logged-out session (signature matched!), so we
    // still surface null rather than propagating.
    return null;
  }
}

// ---- Generic short-lived signed tokens ----

/**
 * Sign an arbitrary claims object as a compact HS256 JWT, stamping `iat`/`exp`
 * and the mandatory `purpose` claim. The generic counterpart to
 * {@link createSessionToken} — for short-lived, single-purpose tokens (e.g.
 * the pending-2FA handle, `purpose: '2fa-pending'`) that ride in their own
 * cookie and are read back with {@link verifySignedToken} under the SAME
 * purpose. The purpose is the token's type: two token kinds signed with the
 * same secret can never be accepted for each other (`purpose` is a reserved
 * claim — passing it inside `claims` throws; `'session'` is taken by
 * {@link SESSION_TOKEN_PURPOSE}). It is deliberately HMAC-based under
 * **every** `jwt.algorithm` — these tokens never leave the deployment, so
 * asymmetric verification buys nothing, which is why `jwt.secret` stays
 * required even in ES256 mode. No new key material is introduced; pass
 * `config.jwt.secret`. `expiresInSeconds` should be small (minutes).
 */
export async function createSignedToken(
  claims: Record<string, unknown> & { purpose?: never },
  secret: string,
  expiresInSeconds: number,
  purpose: string
): Promise<string> {
  requireValidPurpose(purpose, 'createSignedToken');
  if (purpose === SESSION_TOKEN_PURPOSE) {
    // Enforce the reservation instead of only documenting it: a consumer
    // minting its own short-lived tokens under 'session' would collide with
    // real session cookies in verifySignedToken (adversarial review, F1/LOW).
    throw new Error(
      `[auth] createSignedToken: purpose '${SESSION_TOKEN_PURPOSE}' is reserved for session tokens — mint those via createSessionToken; pick a distinct purpose (e.g. 'magic-link').`
    );
  }
  if ('purpose' in claims) {
    // Reserved claim — silently overwriting (in either direction) could mask
    // a caller minting under a different purpose than it believes.
    throw new Error(
      '[auth] createSignedToken: `purpose` is a reserved claim — pass it as the `purpose` parameter, not inside `claims`.'
    );
  }
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncodeString(
    JSON.stringify({ ...claims, purpose, iat: now, exp: now + expiresInSeconds })
  );
  const signature = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a {@link createSignedToken} token: timing-safe signature check plus a
 * **mandatory, in-date `exp`** plus a **mandatory `purpose` match** — a token
 * whose `purpose` claim is missing or differs from the `purpose` argument is
 * rejected in the primitive, whatever its other claims say. Returns the
 * decoded claims on success, else `null` (oversized, malformed, bad
 * signature, missing/expired `exp`, wrong purpose) — never throws on token
 * input (an invalid `purpose` ARGUMENT throws: that is API misuse, not a bad
 * token). A valid signature+purpose still does not vouch for claim shape: the
 * caller SHOULD keep checking the domain claims it expects (e.g. a string
 * `sub`), exactly as `verifySessionToken` validates its claim shape.
 */
export async function verifySignedToken<T extends Record<string, unknown>>(
  token: string,
  secret: string,
  purpose: string
): Promise<(T & { purpose: string; iat: number; exp: number }) | null> {
  requireValidPurpose(purpose, 'verifySignedToken');
  // Length cap before ANY parsing — see MAX_TOKEN_LENGTH.
  if (token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;
  const [header, body, signature] = parts;

  let valid: boolean;
  try {
    valid = await hmacVerify(`${header}.${body}`, signature, secret);
  } catch {
    // A malformed secret makes importKey reject — treat as a failed verify
    // (fail-closed) rather than letting the rejection surface as a 500.
    return null;
  }
  if (!valid) return null;

  try {
    const payload = JSON.parse(base64UrlDecodeString(body));
    // exp is mandatory: a missing/non-numeric exp would be an unbounded token.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    // Purpose binding — strict equality, fail-closed on absence: a token
    // minted for another purpose (or a session token, purpose 'session')
    // never reaches the caller's domain checks.
    if (payload.purpose !== purpose) return null;
    return payload as T & { purpose: string; iat: number; exp: number };
  } catch {
    return null;
  }
}
