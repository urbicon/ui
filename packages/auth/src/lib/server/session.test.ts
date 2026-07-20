import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig, AuthSession, JwtConfig } from '../types.js';
import type { FullAuthUser } from './adapters/types.js';
import {
  clearSessionCookie,
  establishSession,
  getSessionFromCookie,
  resolveSessionMeta,
  setSessionCookie
} from './session.js';

const jwtConfig: JwtConfig = { secret: 'test-secret', expiresIn: '1h', cookieName: 'test-session' };

function createMockCookies() {
  const store = new Map<string, string>();
  return {
    get: vi.fn((name: string) => store.get(name)),
    set: vi.fn((name: string, value: string, _opts?: unknown) => store.set(name, value)),
    delete: vi.fn((name: string, _opts?: unknown) => store.delete(name)),
    getAll: vi.fn(() => []),
    serialize: vi.fn(() => ''),
    _store: store
  };
}

describe('setSessionCookie', () => {
  it('should set a cookie with the configured name', async () => {
    const cookies = createMockCookies();
    const payload: AuthSession = { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 };

    await setSessionCookie(cookies as unknown as Cookies, payload, jwtConfig);

    expect(cookies.set).toHaveBeenCalledWith(
      'test-session',
      expect.any(String),
      expect.objectContaining({
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'lax'
      })
    );
  });

  it('should use default cookie name when not configured', async () => {
    const cookies = createMockCookies();
    const config: JwtConfig = { secret: 'test' };

    await setSessionCookie(
      cookies as unknown as Cookies,
      { userId: '1', email: 'a@b.c', role: 'u', tokenVersion: 0 },
      config
    );

    expect(cookies.set).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
  });
});

describe('clearSessionCookie', () => {
  it('should delete the cookie', () => {
    const cookies = createMockCookies();
    clearSessionCookie(cookies as unknown as Cookies, jwtConfig);
    expect(cookies.delete).toHaveBeenCalledWith('test-session', { path: '/' });
  });
});

describe('getSessionFromCookie', () => {
  it('should return null when no cookie exists', async () => {
    const cookies = createMockCookies();
    const result = await getSessionFromCookie(cookies as unknown as Cookies, jwtConfig);
    expect(result).toBeNull();
  });

  it('should roundtrip set → get', async () => {
    const cookies = createMockCookies();
    const payload: AuthSession = {
      userId: 'user-1',
      email: 'a@b.c',
      role: 'admin',
      tokenVersion: 3
    };

    await setSessionCookie(cookies as unknown as Cookies, payload, jwtConfig);
    const result = await getSessionFromCookie(cookies as unknown as Cookies, jwtConfig);

    expect(result).toEqual(payload);
  });

  it('should return null for invalid tokens', async () => {
    const cookies = createMockCookies();
    cookies._store.set('test-session', 'invalid-token');

    const result = await getSessionFromCookie(cookies as unknown as Cookies, jwtConfig);
    expect(result).toBeNull();
  });
});

describe('cookieDomain (IdP session sharing across subdomains)', () => {
  const payload: AuthSession = { userId: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 };
  const domainConfig: JwtConfig = {
    secret: 'test-secret',
    cookieName: 'sso-session',
    cookieDomain: '.example.com'
  };

  it('stamps the Domain attribute on set', async () => {
    const cookies = createMockCookies();
    await setSessionCookie(cookies as unknown as Cookies, payload, domainConfig);
    expect(cookies.set).toHaveBeenCalledWith(
      'sso-session',
      expect.any(String),
      expect.objectContaining({ domain: '.example.com', path: '/' })
    );
  });

  it('clears with the SAME Domain attribute — an asymmetric delete would leave the session alive', async () => {
    const cookies = createMockCookies();
    clearSessionCookie(cookies as unknown as Cookies, domainConfig);
    expect(cookies.delete).toHaveBeenCalledWith('sso-session', {
      path: '/',
      domain: '.example.com'
    });
  });

  it('omits the Domain attribute entirely when not configured (host-scoped default)', async () => {
    const cookies = createMockCookies();
    await setSessionCookie(cookies as unknown as Cookies, payload, jwtConfig);
    expect(cookies.set.mock.calls[0][2]).not.toHaveProperty('domain');
    clearSessionCookie(cookies as unknown as Cookies, jwtConfig);
    expect(cookies.delete).toHaveBeenCalledWith('test-session', { path: '/' });
  });

  it('rejects a __Host- cookieName combined with cookieDomain — set and clear alike', async () => {
    // Browsers drop a __Host- cookie that carries a Domain attribute, so the
    // combination would silently never establish (or clear) a session.
    const hostPrefixed: JwtConfig = {
      secret: 'test-secret',
      cookieName: '__Host-session',
      cookieDomain: '.example.com'
    };
    const cookies = createMockCookies();
    await expect(
      setSessionCookie(cookies as unknown as Cookies, payload, hostPrefixed)
    ).rejects.toThrow(/__Host-/);
    expect(() => clearSessionCookie(cookies as unknown as Cookies, hostPrefixed)).toThrow(
      /__Host-/
    );
    expect(cookies.set).not.toHaveBeenCalled();
    expect(cookies.delete).not.toHaveBeenCalled();
  });
});

describe('resolveSessionMeta', () => {
  const event = (userAgent?: string, ip = '203.0.113.7') => ({
    request: new Request(
      'http://localhost',
      userAgent ? { headers: { 'user-agent': userAgent } } : {}
    ),
    getClientAddress: () => ip
  });

  it('captures the user-agent and omits the IP by default', () => {
    const meta = resolveSessionMeta(event('Mozilla/5.0'), {});
    expect(meta).toEqual({ userAgent: 'Mozilla/5.0', ip: undefined });
  });

  it('captures the IP only when sessions.storeIp is enabled', () => {
    const meta = resolveSessionMeta(event('Mozilla/5.0'), { sessions: { storeIp: true } });
    expect(meta).toEqual({ userAgent: 'Mozilla/5.0', ip: '203.0.113.7' });
  });

  it('falls back to undefined user-agent when the header is absent', () => {
    const meta = resolveSessionMeta(event(undefined), { sessions: { storeIp: true } });
    expect(meta.userAgent).toBeUndefined();
    expect(meta.ip).toBe('203.0.113.7');
  });
});

describe('establishSession refresh-repo guard', () => {
  const baseConfig: AuthConfig = { appUrl: 'https://app.test', jwt: { secret: 's' } };
  const user = { id: '1', email: 'a@b.c', role: 'user', tokenVersion: 0 } as FullAuthUser;

  // Defense-in-depth: establishSession is a public export, so this guard must
  // hold even when a consumer reaches it without the createAuthDeps wiring.
  it('throws when config.refreshToken is set but repos.refreshToken is missing', async () => {
    await expect(
      establishSession(
        createMockCookies() as unknown as Cookies,
        user,
        { ...baseConfig, refreshToken: {} },
        {}
      )
    ).rejects.toThrow(/repos\.refreshToken is missing/);
  });

  it('establishes a session (no throw) when refresh rotation is not configured', async () => {
    const cookies = createMockCookies();
    await establishSession(cookies as unknown as Cookies, user, baseConfig, {});
    expect(cookies.set).toHaveBeenCalledWith('session', expect.any(String), expect.any(Object));
  });
});
