import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import type { Repositories } from './adapters/types.js';
import {
  assertCookieSameSiteSecure,
  describeCookieSecureDisagreement,
  isSecureDeployment
} from './cookie-policy.js';
import { ensureCsrfCookie } from './csrf.js';
import { __resetSeenSecretsForTests, createAuthDeps } from './deps.js';
import { createAuthHandle } from './handle.js';
import { createMockInvitationRepository, createMockUserRepository } from './test-utils.js';
import { setPending2faCookie } from './two-factor.js';

// Every bundle here is built from `secret: 's'`; the process-wide repeat
// registry would otherwise warn on the unmocked console from the second on.
beforeEach(() => __resetSeenSecretsForTests());

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
    expect(() => assertCookieSameSiteSecure('csrf', 'none', false)).toThrow(/csrf.cookieSameSite/);
  });
});

describe('the CSRF cookie is not exempt from the SameSite/Secure rule', () => {
  // It is the third cookie the package writes, and it took the same shape as the
  // other two: nothing threw at wiring, `ensureCsrfCookie` wrote
  // {sameSite:'none', secure:false}, the browser discarded it, and every mutating
  // request 403'd while every GET stayed green.
  const misconfig = {
    csrf: { doubleSubmit: true, cookieSameSite: 'none', cookieSecure: false }
  } as Partial<AuthConfig>;

  it('createAuthDeps throws', () => {
    expect(() => createAuthDeps(wiring(misconfig))).toThrow(/csrf.cookieSameSite: "none"/);
  });

  it('createAuthHandle throws', () => {
    expect(() => createAuthHandle(wiring(misconfig) as never)).toThrow(
      /csrf.cookieSameSite: "none"/
    );
  });

  it('ensureCsrfCookie throws rather than writing a cookie the browser drops', () => {
    const { store, cookies } = cookieJar();
    expect(() => ensureCsrfCookie(cookies, { sameSite: 'none', secure: false })).toThrow(
      /csrf.cookieSameSite: "none"/
    );
    expect(store.size).toBe(0);
  });

  it('accepts SameSite=None when useHostPrefix force-sets Secure', () => {
    // useHostPrefix overrides cookieSecure, so the pair is legal — the wiring
    // check has to read the effective value, not the raw field.
    expect(() =>
      createAuthDeps(
        wiring({
          csrf: { useHostPrefix: true, cookieSameSite: 'none', cookieSecure: false }
        } as Partial<AuthConfig>)
      )
    ).not.toThrow();
    const { cookies } = cookieJar();
    expect(() =>
      ensureCsrfCookie(cookies, { hostPrefix: true, sameSite: 'none', secure: false })
    ).not.toThrow();
  });
});

describe('cookieSecure disagreeing between the cookie configs', () => {
  // One explicit `false` switches off HSTS, all four production brute-force
  // warnings, and the __Host- prefix + Secure flag on the 2FA and passkey
  // cookies — while the cookies whose config kept the default are still written
  // Secure and dropped by a browser over plain HTTP. Nothing used to say so.
  it('reports csrf declaring non-HTTPS while the session cookie stays Secure', () => {
    const warn = vi.fn();
    createAuthDeps(
      wiring({ csrf: { cookieSecure: false }, logger: { warn, error: vi.fn() } } as never)
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cookieSecure disagrees'));
  });

  it('reports the reverse: a dev session cookie with a Secure CSRF cookie', () => {
    // jwt:false + csrf present without cookieSecure → the CSRF cookie is written
    // Secure over plain HTTP, dropped, and double-submit 403s every mutation.
    expect(describeCookieSecureDisagreement({ jwt: { cookieSecure: false }, csrf: {} })).toMatch(
      /csrf.*= true/s
    );
  });

  it('says nothing when the present configs agree', () => {
    expect(describeCookieSecureDisagreement({ jwt: {} })).toBeNull();
    expect(describeCookieSecureDisagreement({ jwt: { cookieSecure: false } })).toBeNull();
    expect(
      describeCookieSecureDisagreement({
        jwt: { cookieSecure: false },
        csrf: { cookieSecure: false },
        refreshToken: { cookieSecure: false }
      })
    ).toBeNull();
    expect(describeCookieSecureDisagreement({ jwt: {}, csrf: {}, refreshToken: {} })).toBeNull();
  });

  it('counts useHostPrefix as Secure', () => {
    // The prefix force-sets Secure, so this CSRF cookie agrees with a default jwt
    // even though cookieSecure says false — but it DISAGREES with a dev session.
    expect(
      describeCookieSecureDisagreement({
        jwt: {},
        csrf: { useHostPrefix: true, cookieSecure: false }
      })
    ).toBeNull();
    expect(
      describeCookieSecureDisagreement({
        jwt: { cookieSecure: false },
        csrf: { useHostPrefix: true, cookieSecure: false }
      })
    ).toMatch(/cookieSecure disagrees/);
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
