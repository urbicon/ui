import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../auth.js';
import type { AuthDeps } from '../deps.js';
import { setSessionCookie } from '../session.js';
import {
  createMockAuthDeps,
  createMockBackupCodeRepository,
  createMockUser,
  mockPostEvent
} from '../test-utils.js';
import { base32Decode, encryptSecret, generateTotpSecret, totp } from '../totp.js';
import { createPending2faToken, hashBackupCode, setPending2faCookie } from '../two-factor.js';
import {
  createTwoFactorDisableHandler,
  createTwoFactorEnableHandler,
  createTwoFactorSetupHandler,
  createTwoFactorVerifyHandler
} from './two-factor.js';

const ENC_KEY = 'test-2fa-encryption-key-0123456789';
const SECRET = generateTotpSecret();

/** A currently-valid TOTP code for SECRET. */
function currentCode(): Promise<string> {
  return totp(base32Decode(SECRET), { algorithm: 'SHA-1', digits: 6, period: 30 });
}

/** Build an authenticated POST event whose session cookie matches `deps`. */
async function authed<R extends string>(deps: AuthDeps<R>, body: unknown) {
  const ev = mockPostEvent(body);
  await setSessionCookie(
    ev.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'test@test.com', role: 'admin' as R, tokenVersion: 0 },
    deps.config.jwt
  );
  return ev;
}

const as = (ev: ReturnType<typeof mockPostEvent>) => ev as unknown as RequestEvent;

describe('createTwoFactorSetupHandler', () => {
  it('returns 401 when not authenticated', async () => {
    const deps = createMockAuthDeps({ config: { twoFactor: { encryptionKey: ENC_KEY } } });
    const res = await createTwoFactorSetupHandler(deps).POST(as(mockPostEvent({})));
    expect(res.status).toBe(401);
  });

  it('returns 400 when 2FA is already enabled', async () => {
    const user = createMockUser({ totpEnabled: true });
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) }
    });
    const res = await createTwoFactorSetupHandler(deps).POST(as(await authed(deps, {})));
    expect(res.status).toBe(400);
    expect(deps.repos.user.setTotpSecret).not.toHaveBeenCalled();
  });

  it('stages an encrypted secret and returns the otpauth URI', async () => {
    const user = createMockUser({ totpEnabled: false });
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) }
    });
    const res = await createTwoFactorSetupHandler(deps).POST(as(await authed(deps, {})));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.secret).toMatch(/^[A-Z2-7]+$/);
    expect(data.otpauthUri).toContain('otpauth://totp/');
    expect(data.otpauthUri).toContain(`secret=${data.secret}`);
    // Stored value is encrypted, never the plaintext secret.
    const stored = (deps.repos.user.setTotpSecret as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(stored).not.toBe(data.secret);
    expect(stored).toContain(':'); // iv:ciphertext
  });
});

describe('createTwoFactorEnableHandler', () => {
  it('returns 400 when no setup is in progress', async () => {
    const user = createMockUser({ totpEnabled: false, totpSecret: null });
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode: createMockBackupCodeRepository()
    });
    const res = await createTwoFactorEnableHandler(deps).POST(
      as(await authed(deps, { code: '123456' }))
    );
    expect(res.status).toBe(400);
    expect(deps.repos.user.enableTotp).not.toHaveBeenCalled();
  });

  it('returns 400 on an invalid code (no enable, no codes issued)', async () => {
    const user = createMockUser({
      totpEnabled: false,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const backupCode = createMockBackupCodeRepository();
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode
    });
    const res = await createTwoFactorEnableHandler(deps).POST(
      as(await authed(deps, { code: '000000' }))
    );
    expect(res.status).toBe(400);
    expect(deps.repos.user.enableTotp).not.toHaveBeenCalled();
    expect(backupCode.createMany).not.toHaveBeenCalled();
  });

  it('enables 2FA and returns backup codes on a valid code', async () => {
    const user = createMockUser({
      totpEnabled: false,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const backupCode = createMockBackupCodeRepository();
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode
    });
    const res = await createTwoFactorEnableHandler(deps).POST(
      as(await authed(deps, { code: await currentCode() }))
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.backupCodes).toHaveLength(10);
    // Old codes cleared before new ones issued; then the flag flips.
    expect(backupCode.deleteAll).toHaveBeenCalledWith('user-1');
    expect(backupCode.createMany).toHaveBeenCalledWith('user-1', expect.any(Array));
    expect(deps.repos.user.enableTotp).toHaveBeenCalledWith('user-1');
  });

  it('returns 400 when already enabled', async () => {
    const user = createMockUser({
      totpEnabled: true,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode: createMockBackupCodeRepository()
    });
    const res = await createTwoFactorEnableHandler(deps).POST(
      as(await authed(deps, { code: await currentCode() }))
    );
    expect(res.status).toBe(400);
  });
});

describe('createTwoFactorDisableHandler', () => {
  it('returns 403 (re-auth) when the password is wrong', async () => {
    const user = createMockUser({
      totpEnabled: true,
      passwordHash: await hashPassword('correct')
    });
    const backupCode = createMockBackupCodeRepository();
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode
    });
    const res = await createTwoFactorDisableHandler(deps).POST(
      as(await authed(deps, { currentPassword: 'WRONG' }))
    );
    expect(res.status).toBe(403);
    expect(deps.repos.user.disableTotp).not.toHaveBeenCalled();
  });

  it('disables 2FA and clears backup codes after re-auth', async () => {
    const user = createMockUser({
      totpEnabled: true,
      passwordHash: await hashPassword('correct')
    });
    const backupCode = createMockBackupCodeRepository();
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode
    });
    const res = await createTwoFactorDisableHandler(deps).POST(
      as(await authed(deps, { currentPassword: 'correct' }))
    );
    expect(res.status).toBe(200);
    expect(deps.repos.user.disableTotp).toHaveBeenCalledWith('user-1');
    expect(backupCode.deleteAll).toHaveBeenCalledWith('user-1');
  });
});

describe('createTwoFactorVerifyHandler', () => {
  function verifyDeps(user = createMockUser({ totpEnabled: true })) {
    return createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode: createMockBackupCodeRepository()
    });
  }

  async function withPending<R extends string>(
    deps: AuthDeps<R>,
    body: unknown,
    userId = 'user-1'
  ) {
    const ev = mockPostEvent(body);
    setPending2faCookie(
      ev.cookies as unknown as Cookies,
      await createPending2faToken(userId, deps.config),
      deps.config
    );
    return ev;
  }

  it('returns 400 when there is no pending cookie', async () => {
    const deps = verifyDeps();
    const res = await createTwoFactorVerifyHandler(deps).POST(
      as(mockPostEvent({ code: '123456' }))
    );
    expect(res.status).toBe(400);
  });

  it('verifies a TOTP code and establishes a session', async () => {
    const user = createMockUser({
      totpEnabled: true,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const deps = verifyDeps(user);
    const ev = await withPending(deps, { code: await currentCode() });
    const res = await createTwoFactorVerifyHandler(deps).POST(as(ev));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe('user-1');
    expect(data.user).not.toHaveProperty('totpSecret');
    expect(ev._cookieStore.get('session')).toBeTruthy();
  });

  it('redeems a backup code when the TOTP code does not match', async () => {
    const user = createMockUser({
      totpEnabled: true,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const deps = createMockAuthDeps({
      config: { twoFactor: { encryptionKey: ENC_KEY } },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode: createMockBackupCodeRepository({
        consumeIfUnused: vi.fn().mockResolvedValue(true)
      })
    });
    const ev = await withPending(deps, { code: 'ABCD-EFGH-IJKL-MNOP' });
    const res = await createTwoFactorVerifyHandler(deps).POST(as(ev));
    expect(res.status).toBe(200);
    expect(deps.repos.backupCode!.consumeIfUnused).toHaveBeenCalledWith(
      'user-1',
      hashBackupCode('ABCD-EFGH-IJKL-MNOP')
    );
    expect(ev._cookieStore.get('session')).toBeTruthy();
  });

  it('rejects an invalid code without establishing a session and keeps the pending cookie', async () => {
    const user = createMockUser({
      totpEnabled: true,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const deps = verifyDeps(user);
    const ev = await withPending(deps, { code: '000000' });
    const res = await createTwoFactorVerifyHandler(deps).POST(as(ev));
    expect(res.status).toBe(401);
    expect(ev._cookieStore.get('session')).toBeUndefined();
    // The pending cookie survives a wrong attempt so the user can retry.
    expect([...ev._cookieStore.keys()].some((k) => k.includes('urbicon_2fa'))).toBe(true);
  });

  it('returns 429 once the rate limit is exceeded', async () => {
    const user = createMockUser({
      totpEnabled: true,
      totpSecret: await encryptSecret(SECRET, ENC_KEY)
    });
    const deps = createMockAuthDeps({
      config: {
        twoFactor: { encryptionKey: ENC_KEY },
        rateLimit: { twoFactor: { windowMs: 60_000, max: 2 } }
      },
      user: { findById: vi.fn().mockResolvedValue(user) },
      backupCode: createMockBackupCodeRepository()
    });
    const handler = createTwoFactorVerifyHandler(deps);
    const run = async () => handler.POST(as(await withPending(deps, { code: '000000' })));
    expect((await run()).status).toBe(401);
    expect((await run()).status).toBe(401);
    expect((await run()).status).toBe(429);
  });

  it('clears a stale pending cookie when 2FA was disabled since the password step', async () => {
    const user = createMockUser({ totpEnabled: false });
    const deps = verifyDeps(user);
    const ev = await withPending(deps, { code: await currentCode() });
    const res = await createTwoFactorVerifyHandler(deps).POST(as(ev));
    expect(res.status).toBe(400);
    expect([...ev._cookieStore.keys()].some((k) => k.includes('urbicon_2fa'))).toBe(false);
  });
});
