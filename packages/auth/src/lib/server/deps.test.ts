import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import { createAuthDeps } from './deps.js';
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
    expect(deps.config.rateLimit).toBeUndefined();
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
    expect(deps.config.rateLimit).toBeUndefined();
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

  it('does NOT inject a twoFactor limiter when 2FA is not configured', () => {
    const deps = createAuthDeps(baseDeps());
    expect(deps.config.rateLimit?.twoFactor).toBeUndefined();
  });

  it('warns when 2FA is wired but rate-limiting is opted out in production', () => {
    const deps = createAuthDeps(baseDeps({ twoFactor: { encryptionKey: 'k' }, rateLimit: null }));
    expect(deps.config.rateLimit).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('2FA verify endpoint is not rate-limited')
    );
  });
});
