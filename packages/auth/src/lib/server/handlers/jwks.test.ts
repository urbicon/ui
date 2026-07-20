import type { RequestEvent, RequestHandler } from '@sveltejs/kit';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Es256PrivateJwk, Es256PublicJwk, JwtConfig } from '../../types.js';
import { generateES256KeyPair } from '../jwt.js';
import { createJWKSHandler } from './jwks.js';

/**
 * The JWKS endpoint is the ONE place where key material deliberately crosses
 * the trust boundary — these tests therefore lean adversarial: beyond the
 * RFC 7517 shape, they prove that the private scalar `d` (and any other
 * non-allow-listed field smuggled into the config) can never reach the
 * response, even from a maximally polluted config object.
 */

// The handler ignores the request event entirely (static public document).
const invoke = (handler: { GET: RequestHandler }) =>
  handler.GET(undefined as unknown as RequestEvent);

const PUBLISHED_FIELDS = ['alg', 'crv', 'kid', 'kty', 'use', 'x', 'y'];

describe('createJWKSHandler — factory guards', () => {
  it('throws for the default HS256 config (symmetric secret — nothing to publish)', () => {
    expect(() => createJWKSHandler({ jwt: { secret: 's' } })).toThrow(/ES256/);
    expect(() => createJWKSHandler({ jwt: { secret: 's', algorithm: 'HS256' } })).toThrow(/ES256/);
  });

  it('throws for ES256 without a signingKey (fail-loud at wiring, not a runtime 500)', () => {
    expect(() => createJWKSHandler({ jwt: { secret: 's', algorithm: 'ES256' } })).toThrow(
      /signingKey/
    );
  });

  it('throws for a malformed previousPublicKeys entry', async () => {
    const pair = await generateES256KeyPair();
    expect(() =>
      createJWKSHandler({
        jwt: {
          secret: 's',
          algorithm: 'ES256',
          signingKey: pair.privateKey,
          previousPublicKeys: [{ kty: 'EC', crv: 'P-256' } as Es256PublicJwk]
        }
      })
    ).toThrow(/previousPublicKeys/);
  });
});

describe('createJWKSHandler — response', () => {
  let pair: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let retired: Awaited<ReturnType<typeof generateES256KeyPair>>;

  beforeAll(async () => {
    pair = await generateES256KeyPair();
    retired = await generateES256KeyPair();
  });

  it('serves the active public key in RFC 7517 shape with the thumbprint kid', async () => {
    const res = await invoke(createJWKSHandler({ jwt: es256Config() }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      keys: [
        {
          kty: 'EC',
          crv: 'P-256',
          x: pair.publicKey.x,
          y: pair.publicKey.y,
          kid: pair.kid,
          alg: 'ES256',
          use: 'sig'
        }
      ]
    });
  });

  it('uses keyId as the active kid when configured — matching the token header', async () => {
    const res = await invoke(createJWKSHandler({ jwt: es256Config({ keyId: 'active-2026' }) }));
    const body = await res.json();
    expect(body.keys[0].kid).toBe('active-2026');
  });

  it('publishes previousPublicKeys after the active key (rotation window)', async () => {
    const res = await invoke(
      createJWKSHandler({ jwt: es256Config({ previousPublicKeys: [retired.publicKey] }) })
    );
    const body = await res.json();
    expect(body.keys).toHaveLength(2);
    expect(body.keys[0].kid).toBe(pair.kid);
    expect(body.keys[1]).toEqual({
      kty: 'EC',
      crv: 'P-256',
      x: retired.publicKey.x,
      y: retired.publicKey.y,
      kid: retired.kid,
      alg: 'ES256',
      use: 'sig'
    });
  });

  it('is publicly cacheable with a short rotation-friendly TTL', async () => {
    const res = await invoke(createJWKSHandler({ jwt: es256Config() }));
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('never leaks private or extra fields, even from a maximally polluted config', async () => {
    // Adversarial config: the signing key carries junk fields, and a FULL
    // PRIVATE JWK (with `d` and more junk) was pasted into previousPublicKeys.
    // The explicit field-by-field projection must strip every one of them.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const pollutedSigning = {
        ...pair.privateKey,
        p: 'rsa-crt-junk',
        secretNote: 'internal-only',
        use: 'enc'
      } as Es256PrivateJwk;
      const pollutedPrevious = {
        ...retired.privateKey, // includes the private scalar d!
        kid: retired.kid,
        key_ops: ['sign'],
        internal: { database: 'creds' }
      } as Es256PublicJwk;
      const res = await invoke(
        createJWKSHandler({
          jwt: es256Config({
            signingKey: pollutedSigning,
            previousPublicKeys: [pollutedPrevious]
          })
        })
      );
      const body = await res.json();
      const text = JSON.stringify(body);

      // Exact allow-list on every key — nothing beyond the seven public fields.
      for (const key of body.keys) {
        expect(Object.keys(key).sort()).toEqual(PUBLISHED_FIELDS);
        expect(key.use).toBe('sig');
      }
      // The private scalars and the junk values must not appear anywhere.
      expect(text).not.toContain('"d"');
      expect(text).not.toContain(pair.privateKey.d as string);
      expect(text).not.toContain(retired.privateKey.d as string);
      expect(text).not.toContain('secretNote');
      expect(text).not.toContain('internal-only');
      expect(text).not.toContain('creds');
      // The misuse (private JWK in the public list) is warned about loudly.
      expect(err).toHaveBeenCalledWith(expect.stringContaining('private scalar `d`'));
    } finally {
      err.mockRestore();
    }
  });

  function es256Config(overrides: Partial<JwtConfig> = {}): JwtConfig {
    return { secret: 's', algorithm: 'ES256', signingKey: pair.privateKey, ...overrides };
  }
});
