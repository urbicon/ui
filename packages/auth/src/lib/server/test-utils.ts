import { vi } from 'vitest';
import type { AuthConfig } from '../types.js';
import type {
  BackupCodeRepository,
  FullAuthUser,
  Invitation,
  InvitationRepository,
  PasskeyRepository,
  RefreshTokenRepository,
  UserRepository
} from './adapters/types.js';
import type { AuthDeps } from './deps.js';
import type { EmailTransport } from './email/types.js';

/**
 * Shared test fixtures for the server-side repositories. Centralising the mock
 * shape here means an interface change (e.g. the atomic `consume*` claims added
 * in the hardening pass) updates every handler test in one place instead of
 * drifting across half a dozen hand-rolled stubs.
 *
 * Test-only — never imported by published entry points.
 */

export function createMockUser<R extends string>(
  overrides: Partial<FullAuthUser<R>> = {}
): FullAuthUser<R> {
  return {
    id: 'user-1',
    email: 'test@test.com',
    name: 'Test User',
    role: 'admin' as R,
    emailVerified: true,
    totpEnabled: false,
    passwordHash: '',
    tokenVersion: 0,
    failedLoginAttempts: 0,
    lockedUntil: null,
    lastFailedLogin: null,
    verificationToken: null,
    verificationTokenExpires: null,
    passwordResetToken: null,
    passwordResetTokenExpires: null,
    pendingEmail: null,
    emailChangeToken: null,
    emailChangeTokenExpires: null,
    totpSecret: null,
    totpConfirmedAt: null,
    ...overrides
  };
}

export function createMockInvitation(overrides: Partial<Invitation> = {}): Invitation {
  return {
    id: 'inv-1',
    email: 'test@test.com',
    role: 'admin',
    usedAt: null,
    createdAt: new Date(),
    // Live and undelivered by default: the state a test has to opt OUT of is
    // the safe one. An expired fixture would make a passing test meaningless,
    // and a pre-`emailedAt` one would silently grant `autoVerifyInvited`.
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    emailedAt: null,
    ...overrides
  };
}

/**
 * A fully-stubbed `UserRepository`. Every method is a `vi.fn()` so tests can
 * assert calls; pass `overrides` to wire up the specific reads a test drives.
 */
export function createMockUserRepository<R extends string>(
  overrides: Partial<UserRepository<R>> = {}
): UserRepository<R> {
  return {
    findById: vi.fn(),
    findByEmail: vi.fn(),
    create: vi.fn(),
    updatePassword: vi.fn(),
    setEmailVerified: vi.fn(),
    setVerificationToken: vi.fn(),
    consumeVerificationToken: vi.fn(),
    setPasswordResetToken: vi.fn(),
    consumeResetToken: vi.fn(),
    incrementTokenVersion: vi.fn(),
    getFailedLoginAttempts: vi
      .fn()
      .mockResolvedValue({ count: 0, lockedUntil: null, lastFailedAt: null }),
    recordFailedLogin: vi.fn(),
    resetFailedLogins: vi.fn(),
    updateProfile: vi.fn(),
    setEmailChangeToken: vi.fn(),
    consumeEmailChangeToken: vi.fn(),
    delete: vi.fn(),
    setTotpSecret: vi.fn(),
    enableTotp: vi.fn(),
    disableTotp: vi.fn(),
    ...overrides
  } as UserRepository<R>;
}

/**
 * A fully-stubbed `BackupCodeRepository`. `consumeIfUnused` defaults to a failed
 * claim (`false`) so the redeem path is opt-in per test; override it to exercise
 * a successful redemption.
 */
export function createMockBackupCodeRepository(
  overrides: Partial<BackupCodeRepository> = {}
): BackupCodeRepository {
  return {
    createMany: vi.fn(),
    consumeIfUnused: vi.fn().mockResolvedValue(false),
    deleteAll: vi.fn(),
    ...overrides
  } as BackupCodeRepository;
}

/**
 * A fully-stubbed `InvitationRepository`. `markUsedIfUnused` defaults to a
 * successful claim (`true`) so the common register path works without setup;
 * override it to exercise the already-used / lost-race branch.
 */
export function createMockInvitationRepository(
  overrides: Partial<InvitationRepository> = {}
): InvitationRepository {
  return {
    findByEmail: vi.fn(),
    markUsedIfUnused: vi.fn().mockResolvedValue(true),
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    ...overrides
  } as InvitationRepository;
}

/**
 * Assemble a complete `AuthDeps` with stubbed repositories and a sane default
 * config (`appUrl`, HMAC secret). Override any slice via `opts`.
 */
export function createMockAuthDeps<R extends string>(opts?: {
  config?: Partial<AuthConfig<R>>;
  user?: Partial<UserRepository<R>>;
  invitation?: Partial<InvitationRepository>;
  refreshToken?: RefreshTokenRepository;
  backupCode?: BackupCodeRepository;
  passkey?: PasskeyRepository;
  email?: EmailTransport;
}): AuthDeps<R> {
  return {
    // Quiet by default so expected-failure tests don't spam the run; assert on
    // deps.logger.error/warn (they are plain vi.fn mocks) to pin log output.
    logger: { warn: vi.fn(), error: vi.fn() },
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '1h' },
      ...opts?.config
    } as AuthConfig<R>,
    repos: {
      user: createMockUserRepository<R>(opts?.user),
      invitation: createMockInvitationRepository(opts?.invitation),
      refreshToken: opts?.refreshToken,
      backupCode: opts?.backupCode,
      passkey: opts?.passkey
    },
    email: opts?.email ?? { send: vi.fn() }
  };
}

/** A minimal RequestEvent stub for POST handlers that read JSON + client IP. */
export function mockPostEvent(
  body: unknown,
  opts?: { ip?: string; locals?: Record<string, unknown> }
) {
  const cookieStore = new Map<string, string>();
  return {
    request: new Request('http://localhost/api/auth', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    cookies: {
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string) => cookieStore.set(name, value),
      delete: (name: string) => cookieStore.delete(name),
      getAll: () => [],
      serialize: () => ''
    },
    _cookieStore: cookieStore,
    getClientAddress: () => opts?.ip ?? '127.0.0.1',
    url: new URL('http://localhost/api/auth'),
    locals: opts?.locals ?? {}
  };
}
