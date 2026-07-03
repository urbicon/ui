import { describe, expect, it, vi } from 'vitest';
import type { AuthSession, JwtConfig } from '../types.js';
import {
  createSessionToken,
  createSignedToken,
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
