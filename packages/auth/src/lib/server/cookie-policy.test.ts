import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import type { Repositories } from './adapters/types.js';
import { assertCookieSameSiteSecure, isSecureDeployment } from './cookie-policy.js';
import { createAuthDeps } from './deps.js';
import { createAuthHandle } from './handle.js';
import { createMockInvitationRepository, createMockUserRepository } from './test-utils.js';
import { setPending2faCookie } from './two-factor.js';

function cookieJar() {
  const store = new Map<string, string>();
  return {
    store,
    cookies: {
      get: (name: string) => store.get(name),
      set: (name: string, value: string) => void store.set(name, value),
      delete: (name: string) => void store.delete(name),
      getAll: () => [],
      serialize: () => ''
    } as unknown as Cookies
  };
}

function repos(): Repositories {
  return { user: createMockUserRepository(), invitation: createMockInvitationRepository() };
}

function wiring(config: Partial<AuthConfig> & { jwt?: AuthConfig['jwt'] } = {}) {
  return {
    config: { appUrl: 'https://app.test', jwt: { secret: 's' }, ...config } as AuthConfig,
    repos: repos(),
    email: { send: vi.fn() }
  };
}

describe('isSecureDeployment', () => {
  it('is true when no cookie config declares a non-HTTPS deployment', () => {
    expect(isSecureDeployment({ jwt: {} })).toBe(true);
    expect(isSecureDeployment({ jwt: { cookieSecure: true }, csrf: { cookieSecure: true } })).toBe(
      true
    );
  });

  // Each of the three fields is a way an operator declares "this deployment is
  // not HTTPS". Reading only `jwt` gave the other two a `__Host-`+Secure cookie
  // the browser discards.
  it.each([
    ['jwt', { jwt: { cookieSecure: false } }],
    ['csrf', { jwt: {}, csrf: { cookieSecure: false } }],
    ['refreshToken', { jwt: {}, refreshToken: { cookieSecure: false } }]
  ])('is false when %s.cookieSecure is false', (_field, config) => {
    expect(isSecureDeployment(config)).toBe(false);
  });
});

describe('__Host- cookie names follow the deployment signal', () => {
  // A `__Host-`+Secure cookie over plain HTTP is dropped by the browser, and the
  // flow that loses it reports a challenge-store failure (`no_2fa_challenge`),
  // never a cookie problem.
  it.each([
    ['jwt', { secret: 's', cookieSecure: false } as AuthConfig['jwt'], undefined, undefined],
    ['csrf', { secret: 's' } as AuthConfig['jwt'], { cookieSecure: false }, undefined],
    ['refreshToken', { secret: 's' } as AuthConfig['jwt'], undefined, { cookieSecure: false }]
  ])('drops the prefix from the pending-2FA cookie for %s', (_f, jwt, csrf, refreshToken) => {
    const { store, cookies } = cookieJar();
    setPending2faCookie(cookies, 'tok', {
      appUrl: 'https://app.test',
      jwt,
      csrf,
      refreshToken
    } as AuthConfig);
    expect([...store.keys()]).toEqual(['urbicon_2fa']);
  });

  it('keeps the prefix on an HTTPS deployment', () => {
    const { store, cookies } = cookieJar();
    setPending2faCookie(cookies, 'tok', {
      appUrl: 'https://app.test',
      jwt: { secret: 's' }
    } as AuthConfig);
    expect([...store.keys()]).toEqual(['__Host-urbicon_2fa']);
  });

  it('warns about a __Host- CSRF cookie when only refreshToken declares non-HTTPS', () => {
    const warn = vi.fn();
    createAuthHandle({
      config: {
        appUrl: 'https://app.test',
        jwt: { secret: 's' },
        logger: { warn, error: vi.fn() },
        csrf: { doubleSubmit: true, useHostPrefix: true },
        refreshToken: { cookieSecure: false }
      } as AuthConfig,
      repos: { ...repos(), refreshToken: {} as never }
    } as never);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('csrf.useHostPrefix'));
  });
});

describe('assertCookieSameSiteSecure', () => {
  it('returns the resolved secure value for a legal pair', () => {
    expect(assertCookieSameSiteSecure('jwt', 'lax', undefined)).toBe(true);
    expect(assertCookieSameSiteSecure('jwt', 'lax', false)).toBe(false);
    expect(assertCookieSameSiteSecure('jwt', 'none', true)).toBe(true);
  });

  it('throws on SameSite=None without Secure', () => {
    expect(() => assertCookieSameSiteSecure('jwt', 'none', false)).toThrow(
      /jwt.cookieSameSite: "none" requires jwt.cookieSecure: true/
    );
    expect(() => assertCookieSameSiteSecure('refreshToken', 'none', false)).toThrow(
      /refreshToken.cookieSameSite/
    );
  });
});

describe('SameSite=None without Secure is caught at wiring time', () => {
  // Before, only the first cookie WRITE threw — the app booted, the health check
  // passed, logout kept working (clearSessionCookie never resolves `secure`),
  // and the first real login became a 500.
  const sessionMisconfig = {
    jwt: { secret: 's', cookieSameSite: 'none', cookieSecure: false }
  } as Partial<AuthConfig>;
  const refreshMisconfig = {
    refreshToken: { cookieSameSite: 'none', cookieSecure: false }
  } as Partial<AuthConfig>;

  it('createAuthDeps throws for the session cookie', () => {
    expect(() => createAuthDeps(wiring(sessionMisconfig))).toThrow(/jwt.cookieSameSite: "none"/);
  });

  it('createAuthHandle throws for the session cookie', () => {
    expect(() => createAuthHandle(wiring(sessionMisconfig) as never)).toThrow(
      /jwt.cookieSameSite: "none"/
    );
  });

  it('createAuthDeps throws for the refresh cookie', () => {
    const deps = wiring(refreshMisconfig);
    deps.repos = { ...deps.repos, refreshToken: {} as never };
    expect(() => createAuthDeps(deps)).toThrow(/refreshToken.cookieSameSite: "none"/);
  });

  it('createAuthHandle throws for the refresh cookie', () => {
    const opts = wiring(refreshMisconfig);
    opts.repos = { ...opts.repos, refreshToken: {} as never };
    expect(() => createAuthHandle(opts as never)).toThrow(/refreshToken.cookieSameSite: "none"/);
  });

  it('accepts SameSite=None with Secure', () => {
    expect(() =>
      createAuthDeps(wiring({ jwt: { secret: 's', cookieSameSite: 'none', cookieSecure: true } }))
    ).not.toThrow();
  });
});

describe('HSTS follows the deployment signal', () => {
  it('is omitted when csrf declares the deployment non-HTTPS', async () => {
    const handle = createAuthHandle({
      config: {
        appUrl: 'https://app.test',
        jwt: { secret: 's' },
        csrf: { cookieSecure: false }
      } as AuthConfig,
      repos: repos(),
      publicRoutes: ['/']
    });
    const response = await handle({
      event: {
        request: new Request('http://localhost/'),
        url: new URL('http://localhost/'),
        cookies: cookieJar().cookies,
        locals: {},
        getClientAddress: () => '127.0.0.1'
      } as unknown as RequestEvent,
      resolve: async () => new Response('ok')
    });
    expect(response.headers.get('Strict-Transport-Security')).toBeNull();
  });
});
