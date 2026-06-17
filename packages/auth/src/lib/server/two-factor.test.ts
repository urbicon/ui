import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it } from 'vitest';
import type { AuthConfig } from '../types.js';
import { createSignedToken, verifySessionToken } from './auth.js';
import {
  clearPending2faCookie,
  createPending2faToken,
  generateBackupCodes,
  hashBackupCode,
  readPending2faCookie,
  resolveIssuer,
  resolveTotpOptions,
  setPending2faCookie,
  verifyPending2faToken
} from './two-factor.js';

function makeConfig(overrides?: Partial<AuthConfig>): AuthConfig {
  return {
    appUrl: 'https://app.example.com',
    jwt: { secret: 'test-secret', cookieSecure: true },
    twoFactor: { encryptionKey: 'high-entropy-key', pendingTokenTtl: '5m' },
    ...overrides
  } as AuthConfig;
}

function makeCookies(initial: Record<string, string> = {}): Cookies & {
  store: Map<string, string>;
} {
  const store = new Map(Object.entries(initial));
  return {
    store,
    get: (name: string) => store.get(name),
    set: (name: string, value: string) => store.set(name, value),
    delete: (name: string) => store.delete(name),
    getAll: () => [],
    serialize: () => ''
  } as unknown as Cookies & { store: Map<string, string> };
}

describe('pending-2FA token', () => {
  it('round-trips the user id', async () => {
    const config = makeConfig();
    const token = await createPending2faToken('user-42', config);
    expect(await verifyPending2faToken(token, config)).toBe('user-42');
  });

  it('rejects an expired token', async () => {
    const config = makeConfig();
    // Mint a structurally valid pending token whose exp is already in the past.
    const expired = await createSignedToken(
      { pending2fa: true, sub: 'user-42' },
      config.jwt.secret,
      -1
    );
    expect(await verifyPending2faToken(expired, config)).toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await createPending2faToken('user-42', makeConfig());
    const otherConfig = makeConfig({ jwt: { secret: 'other-secret', cookieSecure: true } });
    expect(await verifyPending2faToken(token, otherConfig)).toBeNull();
  });

  it('rejects a tampered token', async () => {
    const config = makeConfig();
    const token = await createPending2faToken('user-42', config);
    const tampered = token.slice(0, -2) + (token.endsWith('A') ? 'B' : 'A');
    expect(await verifyPending2faToken(tampered, config)).toBeNull();
  });

  it('rejects a token missing the pending2fa marker (no token confusion)', async () => {
    const config = makeConfig();
    // A signed token WITHOUT the pending2fa marker must not be accepted.
    const noMarker = await createSignedToken({ sub: 'user-42' }, config.jwt.secret, 300);
    expect(await verifyPending2faToken(noMarker, config)).toBeNull();
  });

  it('is rejected by verifySessionToken (a pending token cannot open a session)', async () => {
    const config = makeConfig();
    const token = await createPending2faToken('user-42', config);
    // The session verifier requires email/role/tv claims the pending token lacks.
    expect(await verifySessionToken(token, config.jwt)).toBeNull();
  });

  it('rejects garbage input', async () => {
    const config = makeConfig();
    expect(await verifyPending2faToken('not-a-token', config)).toBeNull();
    expect(await verifyPending2faToken('', config)).toBeNull();
  });
});

describe('pending-2FA cookie', () => {
  it('uses the __Host- prefix on a secure deployment', async () => {
    const config = makeConfig();
    const cookies = makeCookies();
    const token = await createPending2faToken('u1', config);
    setPending2faCookie(cookies, token, config);
    expect(cookies.store.has('__Host-urbicon_2fa')).toBe(true);
    expect(readPending2faCookie(cookies, config)).toBe(token);
  });

  it('uses the bare name on a non-HTTPS dev deployment', async () => {
    const config = makeConfig({ jwt: { secret: 's', cookieSecure: false } });
    const cookies = makeCookies();
    const token = await createPending2faToken('u1', config);
    setPending2faCookie(cookies, token, config);
    expect(cookies.store.has('urbicon_2fa')).toBe(true);
    expect(cookies.store.has('__Host-urbicon_2fa')).toBe(false);
    expect(readPending2faCookie(cookies, config)).toBe(token);
  });

  it('clears the cookie', async () => {
    const config = makeConfig();
    const cookies = makeCookies();
    setPending2faCookie(cookies, await createPending2faToken('u1', config), config);
    clearPending2faCookie(cookies, config);
    expect(readPending2faCookie(cookies, config)).toBeNull();
  });
});

describe('resolveTotpOptions', () => {
  it('applies the RFC-6238 defaults', () => {
    expect(resolveTotpOptions({ encryptionKey: 'k' })).toEqual({
      algorithm: 'SHA-1',
      digits: 6,
      period: 30,
      window: 1
    });
  });

  it('honours overrides', () => {
    expect(
      resolveTotpOptions({
        encryptionKey: 'k',
        algorithm: 'SHA-256',
        digits: 8,
        period: 60,
        window: 2
      })
    ).toEqual({ algorithm: 'SHA-256', digits: 8, period: 60, window: 2 });
  });
});

describe('resolveIssuer', () => {
  it('defaults to the appUrl host', () => {
    expect(resolveIssuer(makeConfig())).toBe('app.example.com');
  });

  it('honours an explicit issuer', () => {
    expect(resolveIssuer(makeConfig({ twoFactor: { encryptionKey: 'k', issuer: 'My App' } }))).toBe(
      'My App'
    );
  });

  it('falls back to a literal when appUrl is unparseable', () => {
    expect(resolveIssuer(makeConfig({ appUrl: 'not a url' }))).toBe('Urbicon');
  });
});

describe('backup codes', () => {
  it('generates the requested count with matching hashes', () => {
    const { plain, hashes } = generateBackupCodes(8);
    expect(plain).toHaveLength(8);
    expect(hashes).toHaveLength(8);
    // The plaintext is never the stored hash.
    plain.forEach((code, i) => {
      expect(hashes[i]).not.toBe(code);
      expect(hashes[i]).toBe(hashBackupCode(code));
    });
  });

  it('defaults to 10 codes', () => {
    expect(generateBackupCodes().plain).toHaveLength(10);
  });

  it('produces unique codes', () => {
    const { plain } = generateBackupCodes(10);
    expect(new Set(plain).size).toBe(10);
  });

  it('hashes a code identically with or without its separators/case', () => {
    const { plain } = generateBackupCodes(1);
    const code = plain[0];
    const noDashes = code.replace(/-/g, '').toLowerCase();
    expect(hashBackupCode(noDashes)).toBe(hashBackupCode(code));
  });
});
