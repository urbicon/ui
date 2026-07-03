// HS256 JWTs on Web Crypto: the session token (with key rotation via `kid` /
// `previousSecrets`) and the generic short-lived signed token (pending-2FA
// handle etc.). Split out of the former auth.ts god-file (R17).

import type { AuthSession, JwtConfig } from '../types.js';
import { parseDurationSeconds } from './duration.js';
import { base64UrlDecodeString, base64UrlEncode, base64UrlEncodeString } from './encoding.js';
import { timingSafeEqual } from './timing-safe.js';

const BASE64URL_REGEX = /^[A-Za-z0-9_-]+$/;

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

export async function createSessionToken<R extends string>(
  payload: AuthSession<R>,
  config: JwtConfig
): Promise<string> {
  const header = base64UrlEncodeString(
    JSON.stringify({
      alg: 'HS256',
      typ: 'JWT',
      ...(config.keyId ? { kid: config.keyId } : {})
    })
  );
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseDurationSeconds(config.expiresIn ?? '7d');

  const body = base64UrlEncodeString(
    JSON.stringify({
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      tv: payload.tokenVersion,
      iat: now,
      exp
    })
  );

  const signature = await hmacSign(`${header}.${body}`, config.secret);
  return `${header}.${body}.${signature}`;
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

let previousSecretsImportWarned = false;

export async function verifySessionToken<R extends string>(
  token: string,
  config: JwtConfig
): Promise<AuthSession<R> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  if (!parts.every((p) => BASE64URL_REGEX.test(p))) return null;

  const [header, body, signature] = parts;

  let tokenKid: string | undefined;
  try {
    const headerJson = JSON.parse(base64UrlDecodeString(header));
    if (typeof headerJson.kid === 'string') tokenKid = headerJson.kid;
  } catch {
    // Malformed header — treat as "no kid" and keep going; the signature
    // check below will reject the token if it's actually broken.
  }

  const secrets = selectVerifySecrets(config, tokenKid);
  // Iterate every candidate without early break: a timing oracle that reveals
  // which secret matched (primary vs a previousSecret) would let an attacker
  // target sessions still signed by a compromised retired key.
  let valid = false;
  let importErrors = 0;
  for (const secret of secrets) {
    try {
      if (await hmacVerify(`${header}.${body}`, signature, secret)) valid = true;
    } catch (err) {
      // A crypto.subtle.importKey rejection means the config has a malformed
      // secret (empty string, non-string). Don't mask as "no session" forever
      // — warn loudly once so consumers notice the broken previousSecrets.
      importErrors++;
      if (!previousSecretsImportWarned) {
        previousSecretsImportWarned = true;

        console.error(
          '[auth] verifySessionToken: secret import failed — check config.secret / config.previousSecrets.',
          err
        );
      }
    }
  }
  if (!valid) return null;
  // Defensive: if every candidate errored we already bailed via `!valid`, so
  // this branch is just a paranoia marker for future refactors.
  void importErrors;

  try {
    const payload = JSON.parse(base64UrlDecodeString(body));
    // exp is mandatory: a missing/non-numeric exp would otherwise be treated
    // as "never expires", giving anyone in possession of a (current or
    // retired) signing secret an unbounded forge window.
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
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
 * Sign an arbitrary claims object as a compact HS256 JWT, stamping `iat`/`exp`.
 * The generic counterpart to {@link createSessionToken} — for short-lived,
 * single-purpose tokens (e.g. the pending-2FA handle) that ride in their own
 * cookie and are read back with {@link verifySignedToken}. It reuses the exact
 * same HMAC signing as the session token, so no new key material is introduced;
 * pass `config.jwt.secret`. `expiresInSeconds` should be small (minutes).
 */
export async function createSignedToken(
  claims: Record<string, unknown>,
  secret: string,
  expiresInSeconds: number
): Promise<string> {
  const header = base64UrlEncodeString(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64UrlEncodeString(
    JSON.stringify({ ...claims, iat: now, exp: now + expiresInSeconds })
  );
  const signature = await hmacSign(`${header}.${body}`, secret);
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a {@link createSignedToken} token: timing-safe signature check plus a
 * **mandatory, in-date `exp`**. Returns the decoded claims on success, else
 * `null` (malformed, bad signature, missing/expired `exp`) — never throws. A
 * valid signature does NOT vouch for claim shape: the caller MUST still check
 * the domain claims it expects (e.g. `pending2fa === true`, a string `sub`),
 * exactly as `verifySessionToken` validates its claim shape. This is what keeps
 * a token minted for one purpose from being accepted for another.
 */
export async function verifySignedToken<T extends Record<string, unknown>>(
  token: string,
  secret: string
): Promise<(T & { iat: number; exp: number }) | null> {
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
    return payload as T & { iat: number; exp: number };
  } catch {
    return null;
  }
}
