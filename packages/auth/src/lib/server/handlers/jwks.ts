import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { JwtConfig } from '../../types.js';
import { assertJwtConfigValid, resolveActiveKid } from '../jwt.js';
import { privateEndpoints } from './_shared.js';

/**
 * The exact JWK shape this endpoint publishes — an explicit allow-list of
 * public members. Keys are constructed field-by-field from this shape (never
 * by spreading a config object), so private members (`d`, RSA CRT params, …)
 * or arbitrary extra fields on the configured JWKs are structurally unable to
 * reach the response.
 */
interface PublishedEs256Jwk {
  kty: 'EC';
  crv: 'P-256';
  x: string;
  y: string;
  kid: string;
  alg: 'ES256';
  use: 'sig';
}

/**
 * Short client-side TTL: the JWKS document is public and cacheable, but key
 * rotation has to propagate to consumers within minutes — a freshly deployed
 * signing key is useless while consumers still serve a cached key set that
 * lacks its `kid` (they would reject every new token as unknown-kid until the
 * cache expires). Five minutes keeps that window tight without hammering the
 * endpoint.
 */
const JWKS_HEADERS = { 'Cache-Control': 'public, max-age=300' } as const;

function publishJwk(source: JsonWebKey, kid: string): PublishedEs256Jwk {
  if (!source.x || !source.y) {
    // Unreachable after the factory-time assertJwtConfigValid, kept so the
    // projection stays self-defending (and the types stay narrow).
    throw new Error('[auth] createJWKSHandler: key is missing its x/y coordinates.');
  }
  // Explicit field-by-field construction — NEVER spread `source` (see
  // PublishedEs256Jwk): a JWK that carries private members must be
  // structurally unable to reach the response.
  return { kty: 'EC', crv: 'P-256', x: source.x, y: source.y, kid, alg: 'ES256', use: 'sig' };
}

/**
 * RFC 7517 JWKS endpoint factory for `jwt.algorithm: 'ES256'` — serves
 * `{ keys: [...] }` with the **public** half of the active signing key plus
 * every `previousPublicKeys` entry, so consuming services can verify this
 * deployment's session JWTs (and keep verifying tokens signed by a retiring
 * key through its rotation window) without sharing any secret. The JWT only
 * proves identity; what a consumer lets that identity do remains the
 * consumer's own decision. Mount the returned `GET` on a route of your
 * choosing, e.g. `/.well-known/jwks.json`. When it lives outside the default
 * public prefixes, exempt it by spreading them —
 * `publicRoutes: [...DEFAULT_PUBLIC_ROUTES, '/.well-known/']` — since the
 * option replaces the defaults rather than extending them.
 *
 * The active key's `kid` is resolved exactly like the one stamped into new
 * tokens (`keyId` → the JWK's own `kid` → RFC 7638 thumbprint), so the JWKS
 * document and the token headers can never drift apart.
 *
 * Fail-loud contract — misconfiguration throws at **factory** time, never as
 * a runtime 500 or a silently empty key set:
 * - HS256 config (the default): an HMAC secret is symmetric — there is no
 *   public half to publish, and an empty `keys` array would only break
 *   consumers later at verify time.
 * - ES256 with a missing/malformed `signingKey` or malformed
 *   `previousPublicKeys` entries (same validation as the wiring entry points).
 *
 * Only public JWK members (`kty`, `crv`, `x`, `y`, `kid`, `alg`, `use`) are
 * ever emitted; the private scalar `d` cannot reach the response by
 * construction. Responses carry `Cache-Control: public, max-age=300` (see
 * {@link JWKS_HEADERS} for the rotation rationale).
 */
export function createJWKSHandler(config: { jwt: JwtConfig }): { GET: RequestHandler } {
  const jwt = config.jwt;
  if ((jwt.algorithm ?? 'HS256') !== 'ES256') {
    throw new Error(
      '[auth] createJWKSHandler requires jwt.algorithm "ES256". An HS256 secret is symmetric — it has no public half to publish, so a JWKS endpoint cannot exist for it. Switch the config to ES256 (generateES256KeyPair()) or drop this handler.'
    );
  }
  // Same validation as createAuthDeps/createAuthHandle: throws on a missing or
  // malformed signingKey and on unusable previousPublicKeys entries, so every
  // failure mode surfaces here at wiring time.
  assertJwtConfigValid(jwt);

  // The key set is static per config — build it once. After the validation
  // above, the only async step is the RFC 7638 thumbprint digest, which
  // cannot fail on validated key material.
  const keys: Promise<PublishedEs256Jwk[]> = (async () => [
    publishJwk(jwt.signingKey as JsonWebKey, await resolveActiveKid(jwt)),
    ...(jwt.previousPublicKeys ?? []).map((key) => publishJwk(key, key.kid))
  ])();

  return privateEndpoints({
    GET: async () => json({ keys: await keys }, { headers: JWKS_HEADERS })
  });
}
