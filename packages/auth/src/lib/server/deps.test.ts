import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import { createInMemoryRefreshTokenRepository } from './adapters/in-memory.js';
import { createAuthDeps } from './deps.js';
import { generateES256KeyPair } from './jwt.js';
import { lockoutFor, rateLimitFor } from './security-defaults.js';
import { createMockInvitationRepository, createMockUserRepository } from './test-utils.js';

function baseDeps(config: Partial<AuthConfig> & { jwt?: AuthConfig['jwt'] } = {}) {
  return {
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 's' },
      ...config
    } as AuthConfig,
    repos: {
      user: createMockUserRepository(),
      invitation: createMockInvitationRepository()
    },
    email: { send: vi.fn() }
  };
}

describe('createAuthDeps security defaults', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('applies a safe login rate-limit and lockout when neither is configured', () => {
    const deps = createAuthDeps(baseDeps());
    expect(deps.config.rateLimit?.login).toEqual({ windowMs: 15 * 60_000, max: 5 });
    expect(deps.config.lockout).toEqual({ maxAttempts: 5, durationMinutes: 15 });
    // Defaults are safe, so no warning.
    expect(warn).not.toHaveBeenCalled();
  });

  it('does not mutate the caller config object', () => {
    const input = baseDeps();
    createAuthDeps(input);
    expect(input.config.rateLimit).toBeUndefined();
    expect(input.config.lockout).toBeUndefined();
  });

  it('respects an explicit rateLimit and does not inject the lockout default', () => {
    const deps = createAuthDeps(baseDeps({ rateLimit: { login: { windowMs: 1000, max: 3 } } }));
    expect(deps.config.rateLimit?.login).toEqual({ windowMs: 1000, max: 3 });
    // Consumer engaged with brute-force config, so we don't silently add lockout.
    expect(deps.config.lockout).toBeUndefined();
  });

  it('warns and disables when rateLimit is explicitly null in production', () => {
    const deps = createAuthDeps(baseDeps({ rateLimit: null }));
    // `null`, not `undefined`: every handler reads the resolved config back
    // through rateLimitFor, so a rate-limit opt-out has to survive re-resolution.
    // `lockout` needs no such marker — see resolveRateLimits.
    expect(deps.config.rateLimit).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('config.rateLimit is explicitly null')
    );
  });

  it('warns when lockout is explicitly null in production', () => {
    const deps = createAuthDeps(
      baseDeps({ lockout: null, rateLimit: { login: { windowMs: 1, max: 1 } } })
    );
    expect(deps.config.lockout).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.lockout is explicitly null'));
  });

  it('does NOT warn for null opt-out in a dev config (cookieSecure: false)', () => {
    const deps = createAuthDeps(
      baseDeps({ jwt: { secret: 's', cookieSecure: false }, rateLimit: null, lockout: null })
    );
    expect(deps.config.rateLimit).toBeNull();
    expect(deps.config.lockout).toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
  });

  it('injects the login default when only OTHER rate-limit keys are configured', () => {
    // Consumer set a register limit but forgot login — login must NOT be left
    // unprotected (the old behaviour). The login default is injected and the
    // register key is preserved untouched.
    const deps = createAuthDeps(baseDeps({ rateLimit: { register: { windowMs: 1000, max: 3 } } }));
    expect(deps.config.rateLimit?.login).toEqual({ windowMs: 15 * 60_000, max: 5 });
    expect(deps.config.rateLimit?.register).toEqual({ windowMs: 1000, max: 3 });
    // Login is now protected, so the brute-force warning must NOT fire.
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('exposed to brute force'));
    // Consumer engaged with rate-limit config, so lockout stays opt-in.
    expect(deps.config.lockout).toBeUndefined();
  });

  it('warns loudly when login protection is explicitly opted out in production', () => {
    // rateLimit: null disables every limiter; with no lockout that leaves login
    // exposed — the only path that still reaches the loud brute-force warning.
    const deps = createAuthDeps(baseDeps({ rateLimit: null }));
    expect(deps.config.rateLimit?.login).toBeUndefined();
    expect(deps.config.lockout).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('exposed to brute force'));
  });

  it('warns when pbkdf2Iterations is dangerously low in production', () => {
    createAuthDeps(baseDeps({ password: { pbkdf2Iterations: 50_000 } }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('pbkdf2Iterations is 50000'));
  });

  it('does NOT warn for a low pbkdf2Iterations in a dev config (cookieSecure: false)', () => {
    createAuthDeps(
      baseDeps({ jwt: { secret: 's', cookieSecure: false }, password: { pbkdf2Iterations: 1000 } })
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it('does NOT warn when pbkdf2Iterations is at or above the safe floor', () => {
    createAuthDeps(baseDeps({ password: { pbkdf2Iterations: 600_000 } }));
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('pbkdf2Iterations'));
  });

  it('does NOT warn when pbkdf2Iterations is omitted (secure default applies)', () => {
    createAuthDeps(baseDeps());
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('pbkdf2Iterations'));
  });

  it('names an unusable password.minLength instead of correcting it silently', () => {
    // `resolvePasswordPolicy` falls back to 8 so the server check and the client
    // checklist agree; without the warning the deployment believes it set 12.
    // A NaN was the worst case: `length >= NaN` is false, so the server refused
    // EVERY password while the form rendered "At least 8".
    createAuthDeps(baseDeps({ password: { minLength: Number.NaN } }));
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('config.password.minLength is NaN'));
  });

  it('does NOT warn for a usable minLength, including an explicit 0', () => {
    for (const minLength of [12, 0]) {
      createAuthDeps(baseDeps({ password: { minLength } }));
    }
    createAuthDeps(baseDeps());
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('config.password.minLength'));
  });

  it('injects a strict twoFactor rate-limit default when 2FA is wired', () => {
    const deps = createAuthDeps(baseDeps({ twoFactor: { encryptionKey: 'k' } }));
    expect(deps.config.rateLimit?.twoFactor).toEqual({ windowMs: 15 * 60_000, max: 10 });
    // and the login default is still present (not clobbered)
    expect(deps.config.rateLimit?.login).toEqual({ windowMs: 15 * 60_000, max: 5 });
  });

  it('respects an explicit twoFactor rate-limit', () => {
    const deps = createAuthDeps(
      baseDeps({
        twoFactor: { encryptionKey: 'k' },
        rateLimit: { twoFactor: { windowMs: 1000, max: 3 } }
      })
    );
    expect(deps.config.rateLimit?.twoFactor).toEqual({ windowMs: 1000, max: 3 });
  });

  it('injects the twoFactor limiter even when 2FA is not configured', () => {
    // The default table has no conditional entries: a condition here would be a
    // second hand-maintained list of exactly the kind the table removes, and the
    // limiter is only ever built by the 2FA handlers anyway.
    const deps = createAuthDeps(baseDeps());
    expect(deps.config.rateLimit?.twoFactor).toEqual({ windowMs: 15 * 60_000, max: 10 });
    expect(deps.config.rateLimit?.twoFactorDisable).toEqual({ windowMs: 15 * 60_000, max: 5 });
  });

  it('warns when 2FA is wired but rate-limiting is opted out in production', () => {
    const deps = createAuthDeps(baseDeps({ twoFactor: { encryptionKey: 'k' }, rateLimit: null }));
    expect(deps.config.rateLimit).toBeNull();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('2FA verify endpoint is not rate-limited')
    );
  });
});

describe('re-auth rate-limit defaults (R4)', () => {
  // The re-auth endpoints accept the account password from a live session, so
  // a hijacked session must not get an unlimited brute-force budget there —
  // verifyCurrentPassword deliberately records no failed attempt, making the
  // limiter the only brake.
  it('injects login-strength defaults for the re-auth endpoints', () => {
    const deps = createAuthDeps(baseDeps());
    const expected = { windowMs: 15 * 60_000, max: 5 };
    expect(deps.config.rateLimit?.changePassword).toEqual(expected);
    expect(deps.config.rateLimit?.changeEmail).toEqual(expected);
    expect(deps.config.rateLimit?.deleteAccount).toEqual(expected);
    expect(deps.config.rateLimit?.twoFactorDisable).toEqual(expected);
  });

  it('injects the twoFactorDisable default when 2FA is wired', () => {
    const deps = createAuthDeps(baseDeps({ twoFactor: { encryptionKey: 'k' } }));
    expect(deps.config.rateLimit?.twoFactorDisable).toEqual({ windowMs: 15 * 60_000, max: 5 });
  });

  it('respects explicit re-auth limits and the global null opt-out', () => {
    const tuned = createAuthDeps(
      baseDeps({ rateLimit: { changePassword: { windowMs: 1000, max: 3 } } })
    );
    expect(tuned.config.rateLimit?.changePassword).toEqual({ windowMs: 1000, max: 3 });
    // The other re-auth keys still get the default.
    expect(tuned.config.rateLimit?.changeEmail).toEqual({ windowMs: 15 * 60_000, max: 5 });

    const optedOut = createAuthDeps(baseDeps({ rateLimit: null }));
    expect(optedOut.config.rateLimit).toBeNull();
  });
});

describe('forgot-password rate-limit default', () => {
  // The password-reset request endpoint sends an email on every hit for an
  // existing account, so an unlimited endpoint is a mail-bombing / cost vector.
  // Defaulted per-IP but more generous than login (10 vs 5) to tolerate NAT.
  const expected = { windowMs: 15 * 60_000, max: 10 };

  it('injects a generous default when no rate-limit is configured', () => {
    const deps = createAuthDeps(baseDeps());
    expect(deps.config.rateLimit?.forgotPassword).toEqual(expected);
  });

  it('injects the default even when only OTHER rate-limit keys are configured', () => {
    const deps = createAuthDeps(baseDeps({ rateLimit: { register: { windowMs: 1000, max: 3 } } }));
    expect(deps.config.rateLimit?.forgotPassword).toEqual(expected);
  });

  it('respects an explicit forgotPassword limit', () => {
    const deps = createAuthDeps(
      baseDeps({ rateLimit: { forgotPassword: { windowMs: 2000, max: 2 } } })
    );
    expect(deps.config.rateLimit?.forgotPassword).toEqual({ windowMs: 2000, max: 2 });
  });

  it('honours the global null opt-out (no forgotPassword limiter)', () => {
    const deps = createAuthDeps(baseDeps({ rateLimit: null }));
    expect(deps.config.rateLimit).toBeNull();
  });
});

describe('refresh-token wiring validation', () => {
  // config.refreshToken without repos.refreshToken silently downgrades every
  // session to access-token-only (establishSession skips the refresh cookie) —
  // fail loud at wiring time instead.
  it('throws when refreshToken is configured but repos.refreshToken is missing', () => {
    expect(() => createAuthDeps(baseDeps({ refreshToken: {} }))).toThrow(
      /repos\.refreshToken is missing/
    );
  });

  it('does not throw when the refreshToken repo is provided', () => {
    const deps = baseDeps({ refreshToken: {} });
    expect(() =>
      createAuthDeps({
        ...deps,
        repos: { ...deps.repos, refreshToken: createInMemoryRefreshTokenRepository() }
      })
    ).not.toThrow();
  });
});

describe('config.logger seam (R11)', () => {
  it('routes construction warnings to a custom logger instead of console', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const logger = { warn: vi.fn(), error: vi.fn() };
    const deps = createAuthDeps(baseDeps({ logger, rateLimit: null }));
    // The production rateLimit:null warning lands on the injected sink…
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('rateLimit'));
    // …and never on console.
    expect(consoleWarn).not.toHaveBeenCalled();
    // The resolved deps route handler logs to the sink (via the shield).
    deps.logger.error('op failure');
    expect(logger.error).toHaveBeenCalledWith('op failure');
    consoleWarn.mockRestore();
  });

  it('defaults the resolved logger sink to console', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const deps = createAuthDeps(baseDeps());
    deps.logger.error('default sink check');
    expect(consoleError).toHaveBeenCalledWith('default sink check');
    consoleError.mockRestore();
  });
});

describe('logger shielding (silent-failure review)', () => {
  it('a throwing consumer logger never breaks the flow that logs', () => {
    const logger = {
      warn: vi.fn(() => {
        throw new Error('transport down');
      }),
      error: vi.fn(() => {
        throw new Error('transport down');
      })
    };
    // rateLimit:null triggers a construction warning — with an unshielded sink
    // this whole call would throw. Several runtime sites additionally log
    // inside detached fire-and-forget blocks, where a throwing sink would be
    // an unhandled promise rejection.
    const deps = createAuthDeps(baseDeps({ logger, rateLimit: null }));
    expect(logger.warn).toHaveBeenCalled();
    expect(() => deps.logger.error('post-commit failure', new Error('x'))).not.toThrow();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('JWT config validation (ES256 wiring)', () => {
  it('throws when algorithm ES256 is configured without a signingKey', () => {
    expect(() => createAuthDeps(baseDeps({ jwt: { secret: 's', algorithm: 'ES256' } }))).toThrow(
      /signingKey is missing/
    );
  });

  it('warns loudly on the logger when a signingKey is set without algorithm ES256', async () => {
    const { privateKey } = await generateES256KeyPair();
    const logger = { warn: vi.fn(), error: vi.fn() };
    createAuthDeps(baseDeps({ logger, jwt: { secret: 's', signingKey: privateKey } }));
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('jwt.algorithm is not "ES256"')
    );
  });

  it('accepts a well-formed ES256 config', async () => {
    const { privateKey } = await generateES256KeyPair();
    const deps = createAuthDeps(
      baseDeps({ jwt: { secret: 's', algorithm: 'ES256', signingKey: privateKey } })
    );
    expect(deps.config.jwt.algorithm).toBe('ES256');
  });
});

describe('rate-limit defaults cover every declared key', () => {
  // The default list is derived from the key set (`RATE_LIMIT_DEFAULTS` is typed
  // `Record<RateLimitKey, …>`), so a key added to `AuthConfig.rateLimit` without
  // a default is a compile error. This is the runtime half: the shipping config
  // used to default 5 of the 12 keys, and register / resetPassword / verifyEmail
  // / refresh / passkeyAuth got none under any config, with no warning.
  it('injects a default for all twelve keys', () => {
    const deps = createAuthDeps(baseDeps());
    const limits = deps.config.rateLimit ?? {};
    expect(Object.keys(limits).sort()).toEqual(
      [
        'changeEmail',
        'changePassword',
        'deleteAccount',
        'forgotPassword',
        'login',
        'passkeyAuth',
        'refresh',
        'register',
        'resetPassword',
        'twoFactor',
        'twoFactorDisable',
        'verifyEmail'
      ].sort()
    );
    for (const [key, value] of Object.entries(limits)) {
      expect(value, key).toMatchObject({ windowMs: expect.any(Number), max: expect.any(Number) });
    }
  });

  // Per-key opt-out: six keys gained a default that a consumer may not want (a
  // shared office IP onboarding a batch now meets `register` at 10/15 min). The
  // global `rateLimit: null` would take the login brake with it, so the opt-out
  // has to be expressible per key.
  it('honours a single key set to null without touching the others', () => {
    const deps = createAuthDeps(baseDeps({ rateLimit: { register: null } }));
    expect(deps.config.rateLimit?.register).toBeNull();
    expect(rateLimitFor(deps.config, 'register')).toBeUndefined();
    // Everything else keeps its default — including the login brake.
    expect(deps.config.rateLimit?.login).toEqual({ windowMs: 15 * 60_000, max: 5 });
    expect(Object.keys(deps.config.rateLimit ?? {})).toHaveLength(12);
  });

  it('treats an omitted key as absent, not as an opt-out', () => {
    // `{ register: undefined }` is what a spread of an optional field produces;
    // it must NOT read as a decision.
    const deps = createAuthDeps(baseDeps({ rateLimit: { register: undefined } }));
    expect(deps.config.rateLimit?.register).toEqual({ windowMs: 15 * 60_000, max: 10 });
  });

  it('still warns when the per-key opt-out is the login brake itself', () => {
    const logger = { warn: vi.fn(), error: vi.fn() };
    const deps = createAuthDeps(baseDeps({ logger, rateLimit: { login: null } }));
    expect(deps.config.rateLimit?.login).toBeNull();
    // Consumer engaged with rateLimit, so no lockout default backs it up.
    expect(deps.config.lockout).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('exposed to brute force'));
  });

  // Merge, never replacement: a consumer who tunes exactly one key must not
  // lose the other eleven.
  it('keeps every other default when exactly one key is configured', () => {
    const deps = createAuthDeps(
      baseDeps({ rateLimit: { resetPassword: { windowMs: 1, max: 1 } } })
    );
    const limits = deps.config.rateLimit ?? {};
    expect(limits.resetPassword).toEqual({ windowMs: 1, max: 1 });
    expect(Object.keys(limits)).toHaveLength(12);
    expect(limits.login).toEqual({ windowMs: 15 * 60_000, max: 5 });
    expect(limits.refresh).toEqual({ windowMs: 60_000, max: 30 });
  });

  // Resolution has to be a fixed point: the resolved config is handed to
  // createAuthHandle and the handler factories, which read it through the same
  // accessors. A second pass must not re-decide anything.
  it('is idempotent — re-resolving a resolved config changes nothing', () => {
    for (const input of [{}, { rateLimit: null }, { lockout: null }, { rateLimit: {} }] as const) {
      const once = createAuthDeps(baseDeps(input as never)).config;
      const twice = createAuthDeps({ ...baseDeps(), config: once }).config;
      expect(twice.rateLimit, JSON.stringify(input)).toEqual(once.rateLimit);
      expect(twice.lockout, JSON.stringify(input)).toEqual(once.lockout);
    }
  });
});

describe('a hand-built AuthDeps is protected too', () => {
  // `AuthDeps` is an exported type and the package expects consumers to build
  // one (session.ts' defense-in-depth note). It never passed
  // resolveSecurityDefaults, so the login endpoint used to run with
  // `rateLimit=undefined lockout=undefined` — unthrottled and without lockout.
  const handBuilt = {
    logger: { warn: vi.fn(), error: vi.fn() },
    config: { appUrl: 'https://app.test', jwt: { secret: 's' } } as AuthConfig,
    repos: { user: createMockUserRepository(), invitation: createMockInvitationRepository() },
    email: { send: vi.fn() }
  };

  it('gets the login rate-limit through the accessor', () => {
    expect(rateLimitFor(handBuilt.config, 'login')).toEqual({ windowMs: 15 * 60_000, max: 5 });
    expect(rateLimitFor(handBuilt.config, 'resetPassword')).toEqual({
      windowMs: 15 * 60_000,
      max: 10
    });
  });

  it('gets the lockout through the accessor', () => {
    expect(lockoutFor(handBuilt.config)).toEqual({ maxAttempts: 5, durationMinutes: 15 });
  });

  it('still honours the explicit opt-outs', () => {
    expect(rateLimitFor({ ...handBuilt.config, rateLimit: null }, 'login')).toBeUndefined();
    expect(lockoutFor({ ...handBuilt.config, lockout: null })).toBeUndefined();
  });
});
