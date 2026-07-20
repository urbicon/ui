import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthSession, Es256PublicJwk, JwtConfig } from '../types.js';
import {
  assertJwtConfigValid,
  computeJwkThumbprint,
  createSessionToken,
  createSignedToken,
  generateES256KeyPair,
  verifySessionToken,
  verifySignedToken
} from './jwt.js';

const session: AuthSession<'USER'> = {
  userId: 'u-1',
  email: 'u@u',
  role: 'USER',
  tokenVersion: 1
};

function decodeHeader(token: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString());
}

describe('createSessionToken / verifySessionToken', () => {
  const jwtConfig: JwtConfig = { secret: 'test-secret-key-for-testing', expiresIn: '1h' };

  it('should create and verify a token', async () => {
    const payload: AuthSession = {
      userId: 'user-1',
      email: 'test@test.com',
      role: 'admin',
      tokenVersion: 0
    };

    const token = await createSessionToken(payload, jwtConfig);
    expect(token).toBeTruthy();
    expect(token.split('.')).toHaveLength(3);

    const result = await verifySessionToken(token, jwtConfig);
    expect(result).toEqual(payload);
  });

  it('should reject a token with wrong secret', async () => {
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      jwtConfig
    );
    const result = await verifySessionToken(token, { ...jwtConfig, secret: 'wrong-secret' });
    expect(result).toBeNull();
  });

  it('should reject a tampered token', async () => {
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      jwtConfig
    );
    const tampered = `${token.slice(0, -2)}XX`;
    const result = await verifySessionToken(tampered, jwtConfig);
    expect(result).toBeNull();
  });

  it('should reject expired tokens', async () => {
    vi.useFakeTimers();
    const shortConfig: JwtConfig = { secret: 'test', expiresIn: '1s' };
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      shortConfig
    );

    vi.advanceTimersByTime(2000);
    const result = await verifySessionToken(token, shortConfig);
    expect(result).toBeNull();
    vi.useRealTimers();
  });

  it('should reject invalid token formats', async () => {
    expect(await verifySessionToken('', jwtConfig)).toBeNull();
    expect(await verifySessionToken('a.b', jwtConfig)).toBeNull();
    expect(await verifySessionToken('not-a-token', jwtConfig)).toBeNull();
  });

  it('rejects segments with an impossible base64url length (decode throws → null, not a 500)', async () => {
    // len % 4 === 1 passes the charset regex but cannot decode. The old
    // Buffer-based decoder silently truncated such segments; the canonical
    // encoding.ts decoder throws — verify must map either to a clean null.
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      jwtConfig
    );
    const [, body, signature] = token.split('.');
    const bad = 'aaaaa'; // length 5
    expect(await verifySessionToken(`${bad}.${body}.${signature}`, jwtConfig)).toBeNull();
    const [header] = token.split('.');
    expect(await verifySessionToken(`${header}.${bad}.${signature}`, jwtConfig)).toBeNull();
    expect(await verifySessionToken(`${header}.${body}.${bad}`, jwtConfig)).toBeNull();
  });

  it('should use 7d default expiry', async () => {
    const noExpiryConfig: JwtConfig = { secret: 'test' };
    const token = await createSessionToken(
      { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 },
      noExpiryConfig
    );
    const result = await verifySessionToken(token, noExpiryConfig);
    expect(result).not.toBeNull();
  });

  it('rejects a validly-signed token whose claims are missing or wrong-typed', async () => {
    // Sign a payload with the real secret but a broken claim shape, so the
    // signature check passes and only the claim-type guard can reject it.
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    async function signRaw(payload: Record<string, unknown>): Promise<string> {
      const header = enc({ alg: 'HS256', typ: 'JWT' });
      const body = enc(payload);
      const key = await crypto.subtle.importKey(
        'raw',
        new TextEncoder().encode(jwtConfig.secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const sig = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(`${header}.${body}`)
      );
      return `${header}.${body}.${Buffer.from(sig).toString('base64url')}`;
    }

    const future = Math.floor(Date.now() / 1000) + 3600;
    // Missing `sub` entirely.
    expect(
      await verifySessionToken(
        await signRaw({ email: 'a@b.c', role: 'user', tv: 0, exp: future }),
        jwtConfig
      )
    ).toBeNull();
    // `role` is a number, not a string.
    expect(
      await verifySessionToken(
        await signRaw({ sub: '1', email: 'a@b.c', role: 1, tv: 0, exp: future }),
        jwtConfig
      )
    ).toBeNull();
    // `tv` missing.
    expect(
      await verifySessionToken(
        await signRaw({ sub: '1', email: 'a@b.c', role: 'user', exp: future }),
        jwtConfig
      )
    ).toBeNull();
  });
});

describe('createSessionToken / verifySessionToken — key rotation', () => {
  it('omits the kid header when no keyId is configured', async () => {
    const token = await createSessionToken(session, { secret: 's1' });
    const header = decodeHeader(token);
    expect(header).not.toHaveProperty('kid');
  });

  it('embeds the kid header when keyId is configured', async () => {
    const token = await createSessionToken(session, { secret: 's1', keyId: 'v1' });
    const header = decodeHeader(token);
    expect(header.kid).toBe('v1');
  });

  it('verifies a token signed with the primary secret', async () => {
    const config: JwtConfig = { secret: 's1', keyId: 'v1' };
    const token = await createSessionToken(session, config);
    const verified = await verifySessionToken(token, config);
    expect(verified?.userId).toBe('u-1');
  });

  it('rejects a token signed with an unknown secret', async () => {
    const a: JwtConfig = { secret: 's1' };
    const b: JwtConfig = { secret: 's2' };
    const token = await createSessionToken(session, a);
    expect(await verifySessionToken(token, b)).toBeNull();
  });

  it('accepts a token signed with a previous secret during rotation', async () => {
    const before: JwtConfig = { secret: 'old', keyId: 'v1' };
    const after: JwtConfig = {
      secret: 'new',
      keyId: 'v2',
      previousSecrets: [{ secret: 'old', keyId: 'v1' }]
    };

    const oldToken = await createSessionToken(session, before);
    const newToken = await createSessionToken(session, after);

    // Old token still verifies after rotation.
    const oldVerified = await verifySessionToken(oldToken, after);
    expect(oldVerified?.userId).toBe('u-1');

    // New tokens verify under the new config too.
    const newVerified = await verifySessionToken(newToken, after);
    expect(newVerified?.userId).toBe('u-1');
  });

  it('stops accepting a retired secret once removed from previousSecrets', async () => {
    const before: JwtConfig = { secret: 'old', keyId: 'v1' };
    const afterNoHistory: JwtConfig = { secret: 'new', keyId: 'v2' };

    const oldToken = await createSessionToken(session, before);
    expect(await verifySessionToken(oldToken, afterNoHistory)).toBeNull();
  });

  it('prefers the kid-matching secret but falls back to unkeyed secrets', async () => {
    // Consumer rotates but also keeps a legacy unkeyed secret for tokens
    // issued before the rotation introduced kid headers at all.
    const config: JwtConfig = {
      secret: 'primary',
      keyId: 'v2',
      previousSecrets: [{ secret: 'legacy-without-kid' }]
    };

    // Create a token WITHOUT kid using the legacy secret.
    const legacyToken = await createSessionToken(session, { secret: 'legacy-without-kid' });
    const verified = await verifySessionToken(legacyToken, config);
    expect(verified?.userId).toBe('u-1');
  });

  it('ignores an unknown kid and rejects the token', async () => {
    const a: JwtConfig = { secret: 's1', keyId: 'v1' };
    const b: JwtConfig = { secret: 's1', keyId: 'v3' };
    const token = await createSessionToken(session, a);
    // b advertises kid=v3 but the token carries kid=v1 and b does not list
    // v1 in previousSecrets — reject cleanly.
    expect(await verifySessionToken(token, b)).toBeNull();
  });
});

// ---- ES256 test helpers: hand-signed tokens for adversarial cases ----

const encSegment = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

async function hmacSignRaw(signingInput: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput));
  return Buffer.from(sig).toString('base64url');
}

async function es256SignRaw(signingInput: string, privateJwk: JsonWebKey): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x: privateJwk.x, y: privateJwk.y, d: privateJwk.d },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput)
  );
  return Buffer.from(sig).toString('base64url');
}

function futureClaims(): Record<string, unknown> {
  return {
    sub: 'u-1',
    email: 'u@u',
    role: 'USER',
    tv: 1,
    exp: Math.floor(Date.now() / 1000) + 3600
  };
}

describe('ES256 session tokens', () => {
  let pair: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let otherPair: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let esConfig: JwtConfig;

  beforeAll(async () => {
    pair = await generateES256KeyPair();
    otherPair = await generateES256KeyPair();
    esConfig = { secret: 'internal-hmac-secret', algorithm: 'ES256', signingKey: pair.privateKey };
  });

  it('round-trips: signed with the private key, verified via the config', async () => {
    const token = await createSessionToken(session, esConfig);
    expect(token.split('.')).toHaveLength(3);
    expect(await verifySessionToken(token, esConfig)).toEqual(session);
  });

  it('emits raw r‖s signatures (64 bytes — the JWS ES256 wire format, not DER)', async () => {
    const token = await createSessionToken(session, esConfig);
    const sig = Buffer.from(token.split('.')[2], 'base64url');
    expect(sig.length).toBe(64);
  });

  it('stamps alg ES256 and the thumbprint kid into the header by default', async () => {
    const token = await createSessionToken(session, esConfig);
    const header = decodeHeader(token);
    expect(header.alg).toBe('ES256');
    expect(header.kid).toBe(pair.kid);
  });

  it('prefers an explicit keyId as the kid', async () => {
    const token = await createSessionToken(session, { ...esConfig, keyId: 'active-2026' });
    expect(decodeHeader(token).kid).toBe('active-2026');
  });

  it('rejects a tampered body even though the signature is intact', async () => {
    const token = await createSessionToken(session, esConfig);
    const [header, , signature] = token.split('.');
    const forgedBody = encSegment({ ...futureClaims(), role: 'ADMIN' });
    expect(await verifySessionToken(`${header}.${forgedBody}.${signature}`, esConfig)).toBeNull();
  });

  it('rejects a token signed with a different key pair', async () => {
    const foreign: JwtConfig = {
      secret: 'internal-hmac-secret',
      algorithm: 'ES256',
      signingKey: otherPair.privateKey
    };
    const token = await createSessionToken(session, foreign);
    expect(await verifySessionToken(token, esConfig)).toBeNull();
  });

  it('rejects a wrong-key signature even when the header forges the ACTIVE kid', async () => {
    // kid says "active key", signature comes from another key: the kid match
    // must never substitute for the signature check.
    const header = encSegment({ alg: 'ES256', typ: 'JWT', kid: pair.kid });
    const body = encSegment(futureClaims());
    const signature = await es256SignRaw(`${header}.${body}`, otherPair.privateKey);
    expect(await verifySessionToken(`${header}.${body}.${signature}`, esConfig)).toBeNull();
  });

  it('requires a signingKey at sign time (fail loud, not a broken token)', async () => {
    await expect(createSessionToken(session, { secret: 's', algorithm: 'ES256' })).rejects.toThrow(
      /signingKey/
    );
  });

  it('keeps the internal short-lived signed tokens HMAC-based under ES256', async () => {
    // createSignedToken/verifySignedToken (pending-2FA etc.) take the secret
    // directly and stay HS256 by design — the reason `secret` remains
    // required in ES256 mode.
    const token = await createSignedToken({ purpose: 'pending-2fa' }, esConfig.secret, 60);
    expect(decodeHeader(token).alg).toBe('HS256');
    const claims = await verifySignedToken<{ purpose: string }>(token, esConfig.secret);
    expect(claims?.purpose).toBe('pending-2fa');
  });
});

describe('ES256 — algorithm confusion', () => {
  let pair: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let esConfig: JwtConfig;

  beforeAll(async () => {
    pair = await generateES256KeyPair();
    esConfig = { secret: 'internal-hmac-secret', algorithm: 'ES256', signingKey: pair.privateKey };
  });

  it('rejects an HS256-signed token under an ES256 config (alg pinned from config)', async () => {
    const token = await createSessionToken(session, { secret: esConfig.secret });
    expect(await verifySessionToken(token, esConfig)).toBeNull();
  });

  it('rejects an HS256 token HMAC-signed with the public JWK as the guessed secret', async () => {
    // The classic RS/ES→HS downgrade: the attacker knows the public key (it is
    // published via createJWKSHandler) and re-signs a forged payload as HMAC
    // over it, hoping the verifier follows the header's alg. Try plausible
    // serializations of the public key as the HMAC secret — none may verify.
    const body = encSegment(futureClaims());
    for (const guessedSecret of [
      JSON.stringify(pair.publicKey),
      JSON.stringify({ kty: 'EC', crv: 'P-256', x: pair.publicKey.x, y: pair.publicKey.y }),
      `${pair.publicKey.x}${pair.publicKey.y}`
    ]) {
      const header = encSegment({ alg: 'HS256', typ: 'JWT', kid: pair.kid });
      const signature = await hmacSignRaw(`${header}.${body}`, guessedSecret);
      expect(await verifySessionToken(`${header}.${body}.${signature}`, esConfig)).toBeNull();
    }
  });

  it('rejects a header claiming ES256 over an HMAC signature', async () => {
    const header = encSegment({ alg: 'ES256', typ: 'JWT', kid: pair.kid });
    const body = encSegment(futureClaims());
    const signature = await hmacSignRaw(`${header}.${body}`, esConfig.secret);
    expect(await verifySessionToken(`${header}.${body}.${signature}`, esConfig)).toBeNull();
  });

  it('rejects an ES256-signed token under an HS256 config', async () => {
    const token = await createSessionToken(session, esConfig);
    expect(await verifySessionToken(token, { secret: esConfig.secret })).toBeNull();
  });

  it('rejects a token whose header cannot confirm the algorithm (fail-closed)', async () => {
    const secret = 'test-secret';
    const body = encSegment(futureClaims());
    // Unparseable header — even with a VALID HMAC signature over it, the alg
    // cannot be confirmed, so verification must not proceed.
    const garbageHeader = Buffer.from('not-json').toString('base64url');
    const validSig = await hmacSignRaw(`${garbageHeader}.${body}`, secret);
    expect(await verifySessionToken(`${garbageHeader}.${body}.${validSig}`, { secret })).toBeNull();
    // Parseable header without an alg member.
    const algless = encSegment({ typ: 'JWT' });
    const alglessSig = await hmacSignRaw(`${algless}.${body}`, secret);
    expect(await verifySessionToken(`${algless}.${body}.${alglessSig}`, { secret })).toBeNull();
  });
});

describe('ES256 — key rotation via previousPublicKeys', () => {
  let active: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let retired: Awaited<ReturnType<typeof generateES256KeyPair>>;
  let before: JwtConfig;
  let after: JwtConfig;

  beforeAll(async () => {
    active = await generateES256KeyPair();
    retired = await generateES256KeyPair();
    before = { secret: 's', algorithm: 'ES256', signingKey: retired.privateKey };
    after = {
      secret: 's',
      algorithm: 'ES256',
      signingKey: active.privateKey,
      previousPublicKeys: [retired.publicKey]
    };
  });

  it('verifies tokens of the retired key while it is listed, alongside fresh ones', async () => {
    const oldToken = await createSessionToken(session, before);
    const newToken = await createSessionToken(session, after);
    expect((await verifySessionToken(oldToken, after))?.userId).toBe('u-1');
    expect((await verifySessionToken(newToken, after))?.userId).toBe('u-1');
  });

  it('stops accepting the retired key once removed from previousPublicKeys', async () => {
    const oldToken = await createSessionToken(session, before);
    const noHistory: JwtConfig = { secret: 's', algorithm: 'ES256', signingKey: active.privateKey };
    expect(await verifySessionToken(oldToken, noHistory)).toBeNull();
  });

  it('fails closed on an unknown kid — even when a listed key COULD verify the signature', async () => {
    // Signed by the retired key but advertising an unlisted kid: falling back
    // to "try all keys anyway" would verify it (the retired public key is
    // right there) — the kid filter must refuse instead, mirroring
    // selectVerifySecrets.
    const oldTokenUnknownKid = await createSessionToken(session, {
      ...before,
      keyId: 'kid-nobody-knows'
    });
    expect(await verifySessionToken(oldTokenUnknownKid, after)).toBeNull();
  });

  it('tries every configured key for a kid-less token', async () => {
    // Our own ES256 tokens always carry a kid, but the selection semantics
    // mirror selectVerifySecrets: no kid → all candidates.
    const header = encSegment({ alg: 'ES256', typ: 'JWT' });
    const body = encSegment(futureClaims());
    const signature = await es256SignRaw(`${header}.${body}`, retired.privateKey);
    const verified = await verifySessionToken(`${header}.${body}.${signature}`, after);
    expect(verified?.userId).toBe('u-1');
  });
});

describe('generateES256KeyPair / computeJwkThumbprint', () => {
  it('stamps the same deterministic RFC 7638 kid into both JWKs', async () => {
    const pair = await generateES256KeyPair();
    expect(pair.privateKey.kid).toBe(pair.kid);
    expect(pair.publicKey.kid).toBe(pair.kid);
    // Deterministic: recomputing yields the same value, and private/public
    // agree (the thumbprint hashes public members only).
    expect(await computeJwkThumbprint(pair.publicKey)).toBe(pair.kid);
    expect(await computeJwkThumbprint(pair.privateKey)).toBe(pair.kid);
  });

  it('matches the RFC 7638 canonicalisation for the RFC 7517 A.1 EC key', async () => {
    // Pinned against the widely used reference value for this key — guards
    // member order ("crv","kty","x","y") and the no-whitespace JSON form.
    const kid = await computeJwkThumbprint({
      kty: 'EC',
      crv: 'P-256',
      x: 'MKBCTNIcKUSDii11ySs3526iDZ8AiTo7Tu6KPAqv7D4',
      y: '4Etl6SRW2YiLUrN5vfvVHuhp7x8PxltmWWlbbM4IFyM'
    });
    expect(kid).toBe('cn-I_WNMClehiVp51i_0VpOENW1upEerA8sEam5hn-s');
  });

  it('gives distinct keys distinct kids', async () => {
    const a = await generateES256KeyPair();
    const b = await generateES256KeyPair();
    expect(a.kid).not.toBe(b.kid);
  });

  it('exports the private scalar only on the private JWK', async () => {
    const pair = await generateES256KeyPair();
    expect(pair.privateKey.d).toBeTruthy();
    expect(pair.publicKey).not.toHaveProperty('d');
  });

  it('rejects a non-EC JWK', async () => {
    await expect(computeJwkThumbprint({ kty: 'RSA' })).rejects.toThrow(/EC JWK/);
  });
});

describe('assertJwtConfigValid', () => {
  it('throws for ES256 without a signingKey', () => {
    expect(() => assertJwtConfigValid({ secret: 's', algorithm: 'ES256' })).toThrow(
      /signingKey is missing/
    );
  });

  it('throws for ES256 with a public-only signingKey (missing d)', async () => {
    const pair = await generateES256KeyPair();
    expect(() =>
      assertJwtConfigValid({ secret: 's', algorithm: 'ES256', signingKey: pair.publicKey })
    ).toThrow(/PRIVATE P-256 JWK/);
  });

  it('throws for a previousPublicKeys entry without a kid', async () => {
    const active = await generateES256KeyPair();
    const retired = await generateES256KeyPair();
    const kidless = {
      kty: 'EC',
      crv: 'P-256',
      x: retired.publicKey.x,
      y: retired.publicKey.y
    } as Es256PublicJwk;
    expect(() =>
      assertJwtConfigValid({
        secret: 's',
        algorithm: 'ES256',
        signingKey: active.privateKey,
        previousPublicKeys: [kidless]
      })
    ).toThrow(/kid/);
  });

  it('warns loudly (once) when a previousPublicKeys entry carries the private d', async () => {
    const active = await generateES256KeyPair();
    const retired = await generateES256KeyPair();
    const logger = { warn: vi.fn(), error: vi.fn() };
    const config: JwtConfig = {
      secret: 's',
      algorithm: 'ES256',
      signingKey: active.privateKey,
      previousPublicKeys: [{ ...retired.privateKey, kid: retired.kid } as Es256PublicJwk]
    };
    assertJwtConfigValid(config, logger);
    assertJwtConfigValid(config, logger);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('private scalar `d`'));
  });

  it('warns loudly (once) when a signingKey is set without algorithm ES256', async () => {
    const pair = await generateES256KeyPair();
    const logger = { warn: vi.fn(), error: vi.fn() };
    assertJwtConfigValid({ secret: 's', signingKey: pair.privateKey }, logger);
    assertJwtConfigValid({ secret: 's', signingKey: pair.privateKey }, logger);
    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('jwt.algorithm is not "ES256"')
    );
  });

  it('accepts a plain HS256 config silently', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    assertJwtConfigValid({ secret: 's' }, logger);
    assertJwtConfigValid(
      { secret: 's', keyId: 'v1', previousSecrets: [{ secret: 'old' }] },
      logger
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('accepts a well-formed ES256 config silently', async () => {
    const active = await generateES256KeyPair();
    const retired = await generateES256KeyPair();
    const logger = { warn: vi.fn(), error: vi.fn() };
    assertJwtConfigValid(
      {
        secret: 's',
        algorithm: 'ES256',
        signingKey: active.privateKey,
        previousPublicKeys: [retired.publicKey]
      },
      logger
    );
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws when a __Host- cookie name is combined with cookieDomain', () => {
    expect(() =>
      assertJwtConfigValid({
        secret: 's',
        cookieName: '__Host-session',
        cookieDomain: '.example.com'
      })
    ).toThrow(/__Host-/);
  });

  it('throws when the active kid collides with a previousPublicKeys kid', async () => {
    const active = await generateES256KeyPair();
    const retired = await generateES256KeyPair();
    expect(() =>
      assertJwtConfigValid({
        secret: 's',
        algorithm: 'ES256',
        keyId: 'dup',
        signingKey: active.privateKey,
        previousPublicKeys: [{ ...retired.publicKey, kid: 'dup' }]
      })
    ).toThrow(/duplicate JWT key id/);
  });

  it('throws when two previousPublicKeys entries share a kid', async () => {
    const active = await generateES256KeyPair();
    const a = await generateES256KeyPair();
    const b = await generateES256KeyPair();
    expect(() =>
      assertJwtConfigValid({
        secret: 's',
        algorithm: 'ES256',
        signingKey: active.privateKey,
        previousPublicKeys: [
          { ...a.publicKey, kid: 'same' },
          { ...b.publicKey, kid: 'same' }
        ]
      })
    ).toThrow(/duplicate JWT key id/);
  });
});

describe('createSignedToken / verifySignedToken', () => {
  it('round-trips arbitrary claims', async () => {
    const token = await createSignedToken({ purpose: 'x', sub: 'u-1' }, 'secret', 300);
    const claims = await verifySignedToken<{ purpose: string; sub: string }>(token, 'secret');
    expect(claims?.purpose).toBe('x');
    expect(claims?.sub).toBe('u-1');
    expect(typeof claims?.exp).toBe('number');
    expect(typeof claims?.iat).toBe('number');
  });

  it('rejects an expired token (exp in the past)', async () => {
    const token = await createSignedToken({ sub: 'u-1' }, 'secret', -1);
    expect(await verifySignedToken(token, 'secret')).toBeNull();
  });

  it('rejects a wrong secret and a tampered body', async () => {
    const token = await createSignedToken({ sub: 'u-1' }, 'secret', 300);
    expect(await verifySignedToken(token, 'other-secret')).toBeNull();
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');
    expect(await verifySignedToken(tampered, 'secret')).toBeNull();
  });

  it('rejects malformed input without throwing', async () => {
    expect(await verifySignedToken('a.b', 'secret')).toBeNull();
    expect(await verifySignedToken('not a token', 'secret')).toBeNull();
  });
});
