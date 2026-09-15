import type { Cookies, Handle, RequestEvent } from '@sveltejs/kit';
import { isRedirect } from '@sveltejs/kit';
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
    resetFailedLoginsIfStale: vi.fn(),
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
  // No `as InvitationRepository`: the cast used to hide a mock that had stopped
  // implementing the interface. When `findByTokenHash` was added, every test
  // that forgot to override it got `findByTokenHash is not a function` at
  // runtime instead of a compiler error naming the file. Typing the object
  // literal directly is what makes the next added method a build failure.
  const repo: InvitationRepository = {
    findByTokenHash: vi.fn().mockResolvedValue(null),
    findByEmail: vi.fn(),
    markUsedIfUnused: vi.fn().mockResolvedValue(true),
    markEmailed: vi.fn().mockResolvedValue(undefined),
    create: vi.fn(),
    list: vi.fn(),
    delete: vi.fn(),
    ...overrides
  };
  return repo;
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
    cookies: createMockCookies(cookieStore),
    _cookieStore: cookieStore,
    getClientAddress: () => opts?.ip ?? '127.0.0.1',
    url: new URL('http://localhost/api/auth'),
    locals: opts?.locals ?? {}
  };
}

/** The option bag `Cookies.set`/`delete`/`serialize` take, without importing `cookie` for it. */
type CookieOptions = Parameters<Cookies['set']>[2];

/**
 * The attributes SvelteKit fills in for a caller that omits them, so a
 * serialized header carries what the browser really receives. `secure`
 * follows the non-localhost branch of Kit's default.
 */
const COOKIE_DEFAULTS = { httpOnly: true, sameSite: 'lax', secure: true } as const;

/**
 * SvelteKit throws on a write without a `path` (`validate_options`), so the
 * double does too — otherwise a helper that forgot one would pass every test
 * and drop the cookie only in a browser, where the path defaults to the
 * request's directory instead of `/`.
 */
function requirePath(options: CookieOptions): CookieOptions {
  if (options?.path === undefined) {
    throw new Error('You must specify a `path` when setting, deleting or serializing cookies');
  }
  return options;
}

function serializeCookie(name: string, value: string, options: CookieOptions): string {
  const o = { ...COOKIE_DEFAULTS, ...requirePath(options) };
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (o.maxAge !== undefined) parts.push(`Max-Age=${o.maxAge}`);
  if (o.domain) parts.push(`Domain=${o.domain}`);
  parts.push(`Path=${o.path}`);
  if (o.httpOnly) parts.push('HttpOnly');
  if (o.secure) parts.push('Secure');
  if (o.sameSite) {
    const s = String(o.sameSite);
    parts.push(`SameSite=${s[0]?.toUpperCase()}${s.slice(1)}`);
  }
  return parts.join('; ');
}

/**
 * A `Cookies` double over a plain `Map`. `serialize` returns a real
 * `Set-Cookie` header rather than a placeholder, because `createAuthHandle`
 * builds the guard's `401` headers out of it — a double that returned `''`
 * would let every cookie assertion on that response pass on an empty string.
 *
 * `onDelete` is a probe for tests that pin the order of clears against other
 * writes.
 */
export function createMockCookies(
  store: Map<string, string>,
  onDelete?: (name: string) => void
): Cookies {
  return {
    get: (name) => store.get(name),
    getAll: () => [...store].map(([name, value]) => ({ name, value })),
    set: (name, value, options) => {
      requirePath(options);
      store.set(name, value);
    },
    delete: (name, options) => {
      requirePath(options);
      onDelete?.(name);
      store.delete(name);
    },
    serialize: serializeCookie
  };
}

/** One request for {@link createBrowserJar} to drive through a `handle` hook. */
export interface JarRequest<E> {
  /** The mock event the hook runs on; cast to `RequestEvent` on the way in. */
  event: E;
  /** The map its `cookies` write into — the staged jar SvelteKit would flush. */
  store: Map<string, string>;
  /** What `resolve` returns. Default: `200 OK`. */
  respond?: () => Promise<Response>;
}

/**
 * A browser's cookie jar in front of a `handle` hook, so a test reads the
 * cookie state a browser would end up in rather than the one the hook staged.
 *
 * Two rules separate the two. SvelteKit writes the cookies a hook staged on
 * `event.cookies` in exactly two places — inside `resolve(...).then(...)` and
 * on the thrown-redirect path (`respond.js`) — so a hook that returns a
 * Response of its own, which is what the route guard does for `/api/…`,
 * writes none of them. And a browser adopts the `Set-Cookie` headers of any
 * response whatever its status, `Max-Age=0` deleting the cookie.
 *
 * `makeRequest` builds one request from the jar's current cookies; every
 * argument `send` gets past the handle is forwarded to it.
 */
export function createBrowserJar<E, A extends unknown[]>(
  initial: Record<string, string>,
  makeRequest: (cookies: Record<string, string>, ...args: A) => JarRequest<E>
) {
  const jar = new Map(Object.entries(initial));

  const adopt = (response: Response) => {
    for (const header of response.headers.getSetCookie()) {
      const [pair = '', ...attributes] = header.split(';');
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      if (attributes.some((a) => a.trim().toLowerCase() === 'max-age=0')) jar.delete(name);
      else jar.set(name, decodeURIComponent(pair.slice(eq + 1).trim()));
    }
  };

  return {
    get: (name: string) => jar.get(name),
    async send(handle: Handle, ...args: A) {
      const { event, store, respond } = makeRequest(Object.fromEntries(jar), ...args);
      const commit = () => {
        jar.clear();
        for (const [name, value] of store) jar.set(name, value);
      };
      let resolved = false;
      try {
        const response = await handle({
          event: event as unknown as RequestEvent,
          resolve: async () => {
            resolved = true;
            return respond ? await respond() : new Response('OK');
          }
        });
        if (resolved) commit();
        adopt(response);
        return { status: response.status, event, response };
      } catch (err) {
        if (!isRedirect(err)) throw err;
        commit();
        return { status: err.status, event, response: null };
      }
    }
  };
}
