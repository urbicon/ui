import type { Cookies, RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import {
  createInMemoryRefreshTokenRepository,
  createInMemoryStore
} from '../adapters/in-memory.js';
import type {
  NotificationPreferenceRepository,
  NotificationRepository,
  PasskeyRepository,
  PushSubscriptionRepository
} from '../adapters/types.js';
import * as serverIndex from '../index.js';
import { generateES256KeyPair } from '../jwt.js';
import { createNotificationsHandlers } from '../notifications/handlers/notifications.js';
import { createPreferencesHandler } from '../notifications/handlers/preferences.js';
import { createPushKeyHandler } from '../notifications/handlers/push-key.js';
import { createPushSubscriptionHandler } from '../notifications/handlers/push-subscription.js';
import { createStreamHandler } from '../notifications/handlers/stream.js';
import { createNotificationRegistry } from '../notifications/registry.js';
import { createNotificationService } from '../notifications/service.js';
import { createSSEManager } from '../notifications/sse.js';
import { createInMemoryChallengeStore } from '../passkey/challenge-store.js';
import { createPasskeyHandlers } from '../passkey/handlers.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import { createChangeEmailHandler } from './change-email.js';
import { createChangePasswordHandler } from './change-password.js';
import { createDeleteAccountHandler } from './delete-account.js';
import { createForgotPasswordHandler } from './forgot-password.js';
import { createInvitationHandlers } from './invitation.js';
import { createJWKSHandler } from './jwks.js';
import { createLoginHandler } from './login.js';
import { createLogoutHandler } from './logout.js';
import { createMeHandler } from './me.js';
import { createPasswordPolicyHandler } from './password-policy.js';
import { createRefreshHandler } from './refresh.js';
import { createRegisterHandler } from './register.js';
import { createResetPasswordHandler } from './reset-password.js';
import { createSessionsHandlers } from './sessions.js';
import { createTwoFactorHandlers } from './two-factor.js';
import { createUpdateProfileHandler } from './update-profile.js';
import { createVerifyEmailHandler } from './verify-email.js';
import { createVerifyEmailChangeHandler } from './verify-email-change.js';

/**
 * Every response this package puts on the wire carries a `Cache-Control`
 * directive, and only the endpoints listed in {@link STORABLE} carry one that
 * lets a cache keep it.
 *
 * A `200` GET with no cache directive is heuristically storable (RFC 9111
 * §4.2.2) — SvelteKit's `json()` sets only `content-type` and `content-length`,
 * so a shared cache in front of the app, keyed by URL and seeing no
 * `Vary: Cookie`, may hand one account's notification rows, notification
 * preferences or passkey inventory to the next caller.
 *
 * **The oracle is the handler, not the source text.** Each factory is
 * constructed and each verb driven; the assertion reads the header off the
 * `Response` that comes back. A handler that stops reaching `privateEndpoints`
 * — a factory returning its bundle unwrapped, a verb added to a group that is
 * not — fails here, which no reading of the constant's spelling can tell.
 *
 * Both halves of completeness are derived rather than listed: {@link BUNDLES}
 * is checked against the factory exports of `../index.js`, and the verbs are
 * discovered by walking each constructed bundle. A new endpoint is therefore
 * covered without editing a list here, and a new *factory* fails the coverage
 * test by name until it is built above.
 */

/** The verb keys a handler bundle exposes. Anything else is a nested group. */
const VERBS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;

interface Endpoint {
  id: string;
  run: (event: RequestEvent) => Promise<Response>;
}

/**
 * Flatten a constructed bundle into its endpoints. Handles both shapes the
 * package ships: flat (`{ GET }`) and grouped (`{ list: { GET }, … }`).
 */
function endpointsOf(prefix: string, bundle: unknown): Endpoint[] {
  const found: Endpoint[] = [];
  for (const [key, value] of Object.entries(bundle as Record<string, unknown>)) {
    if ((VERBS as readonly string[]).includes(key) && typeof value === 'function') {
      found.push({ id: `${prefix}.${key}`, run: value as Endpoint['run'] });
    } else if (value && typeof value === 'object') {
      found.push(...endpointsOf(`${prefix}.${key}`, value));
    }
  }
  return found;
}

const VAPID_PUBLIC_KEY =
  'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

function passkeyRepo(): PasskeyRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue([]),
    findByCredentialId: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    updateCounter: vi.fn(),
    delete: vi.fn(),
    rename: vi.fn()
  };
}

function notificationRepo(): NotificationRepository {
  return {
    create: vi.fn(),
    findByUser: vi.fn().mockResolvedValue([]),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
    delete: vi.fn(),
    getUnreadCount: vi.fn().mockResolvedValue(0)
  };
}

function preferenceRepo(): NotificationPreferenceRepository {
  return { findByUser: vi.fn().mockResolvedValue([]), upsert: vi.fn() };
}

function pushSubscriptionRepo(): PushSubscriptionRepository {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue('created'),
    delete: vi.fn()
  };
}

/** Deps rich enough that no handler refuses at wiring time. */
function deps() {
  return createMockAuthDeps({
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '1h' },
      refreshToken: {},
      twoFactor: { encryptionKey: 'test-2fa-encryption-key-0123456789' }
    },
    user: { findById: vi.fn().mockResolvedValue(createMockUser({ id: 'user-1' })) },
    refreshToken: createInMemoryRefreshTokenRepository(createInMemoryStore()),
    passkey: passkeyRepo()
  });
}

const registry = () => {
  const r = createNotificationRegistry();
  r.register({ key: 'security', title: 'Security', recipients: [] });
  return r;
};

/**
 * Every endpoint-producing factory, constructed. The keys are the export names
 * so {@link coverage} can compare them against `../index.js` directly.
 */
async function buildBundles(): Promise<Record<string, unknown>> {
  const d = deps();
  const es256 = await generateES256KeyPair();
  const service = createNotificationService({
    registry: registry(),
    sse: createSSEManager(),
    repos: { notification: notificationRepo() }
  });

  return {
    createChangeEmailHandler: createChangeEmailHandler(d),
    createChangePasswordHandler: createChangePasswordHandler(d),
    createDeleteAccountHandler: createDeleteAccountHandler(d),
    createForgotPasswordHandler: createForgotPasswordHandler(d),
    createInvitationHandlers: createInvitationHandlers(d, {
      authorize: () => true,
      roles: ['admin']
    }),
    createJWKSHandler: createJWKSHandler({
      jwt: { algorithm: 'ES256', signingKey: es256.privateKey, secret: 'unused' }
    }),
    createLoginHandler: createLoginHandler(d),
    createLogoutHandler: createLogoutHandler(d),
    createMeHandler: createMeHandler(d),
    createPasswordPolicyHandler: createPasswordPolicyHandler(d),
    createRefreshHandler: createRefreshHandler(d),
    createRegisterHandler: createRegisterHandler(d),
    createResetPasswordHandler: createResetPasswordHandler(d),
    createSessionsHandlers: createSessionsHandlers(d),
    createTwoFactorHandlers: createTwoFactorHandlers(d),
    createUpdateProfileHandler: createUpdateProfileHandler(d),
    createVerifyEmailChangeHandler: createVerifyEmailChangeHandler(d),
    createVerifyEmailHandler: createVerifyEmailHandler(d),
    createNotificationsHandlers: createNotificationsHandlers(service),
    createPreferencesHandler: createPreferencesHandler(preferenceRepo(), registry()),
    createPushKeyHandler: createPushKeyHandler(VAPID_PUBLIC_KEY),
    createPushSubscriptionHandler: createPushSubscriptionHandler(pushSubscriptionRepo()),
    createStreamHandler: createStreamHandler(createSSEManager()),
    createPasskeyHandlers: createPasskeyHandlers(d, {
      rpId: 'app.test',
      rpName: 'Test',
      origin: 'https://app.test',
      challengeStore: createInMemoryChallengeStore()
    })
  };
}

const BUNDLES = await buildBundles();
const ENDPOINTS = Object.entries(BUNDLES).flatMap(([name, bundle]) =>
  endpointsOf(name.replace(/^create/, '').replace(/Handlers?$/, ''), bundle)
);

/**
 * The endpoints allowed a storable directive, with the exact value each must
 * answer. Everything else must be `no-store`, and an entry here that no longer
 * matches its endpoint fails — so this cannot rot into a silent exemption.
 */
const STORABLE: Record<string, string> = {
  'JWKS.GET': 'public, max-age=300',
  'PasswordPolicy.GET': 'public, max-age=300',
  'PushKey.GET': 'public, max-age=300'
};

/** A request that authenticates nobody: drives each endpoint's refusal path. */
function anonymousEvent(): RequestEvent {
  const ev = mockPostEvent({});
  return { ...ev, params: {}, locals: {} } as unknown as RequestEvent;
}

describe('cache directives — coverage', () => {
  it('builds every endpoint-producing factory the package exports', () => {
    const exported = Object.keys(serverIndex)
      .filter((name) => /^create.*Handlers?$/.test(name))
      .sort();
    expect(Object.keys(BUNDLES).sort()).toEqual(exported);
  });

  it('discovers an endpoint under every factory', () => {
    const empty = Object.keys(BUNDLES).filter(
      (name) =>
        !ENDPOINTS.some((e) =>
          e.id.startsWith(name.replace(/^create/, '').replace(/Handlers?$/, ''))
        )
    );
    expect(empty).toEqual([]);
  });
});

describe('cache directives — every endpoint, refusal path', () => {
  it.each(ENDPOINTS.map((e) => [e.id, e] as const))(
    '%s carries a cache directive',
    async (id, endpoint) => {
      const res = await endpoint.run(anonymousEvent());
      await res.body?.cancel();
      expect(res.headers.get('cache-control')).toBe(STORABLE[id] ?? 'no-store');
    }
  );
});

describe('cache directives — the success responses that carry account data', () => {
  const SESSION = {
    userId: 'user-1',
    email: 'test@test.com',
    role: 'admin',
    tokenVersion: 0
  } as never;

  /** An event carrying a valid session cookie AND `locals.user`. */
  async function authedEvent(d: ReturnType<typeof deps>): Promise<RequestEvent> {
    const ev = mockPostEvent({});
    await setSessionCookie(ev.cookies as unknown as Cookies, SESSION, d.config.jwt);
    return {
      ...ev,
      params: {},
      locals: { user: { id: 'user-1', email: 'test@test.com', role: 'admin' } }
    } as unknown as RequestEvent;
  }

  it('me returns the profile with no-store', async () => {
    const d = deps();
    const res = await createMeHandler(d).GET(await authedEvent(d));
    expect(res.status).toBe(200);
    expect((await res.json()).user.email).toBe('test@test.com');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the session list returns rows with no-store', async () => {
    const d = deps();
    const res = await createSessionsHandlers(d).list.GET(await authedEvent(d));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the invitation list returns rows with no-store', async () => {
    const d = deps();
    const handlers = createInvitationHandlers(d, { authorize: () => true, roles: ['admin'] });
    vi.mocked(d.repos.invitation.list).mockResolvedValue([]);
    const res = await handlers.GET(await authedEvent(d));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the notification list returns rows with no-store', async () => {
    const repo = notificationRepo();
    vi.mocked(repo.findByUser).mockResolvedValue([
      {
        id: 'n1',
        userId: 'user-1',
        typeKey: 'security',
        title: 'Password changed',
        body: 'from 10.0.0.1',
        url: null,
        icon: null,
        readAt: null,
        createdAt: new Date()
      }
    ]);
    const service = createNotificationService({
      registry: registry(),
      sse: createSSEManager(),
      repos: { notification: repo }
    });
    const d = deps();
    const res = await createNotificationsHandlers(service).list.GET(await authedEvent(d));
    expect(res.status).toBe(200);
    // The body is the exposure this test exists for — private rows, and the
    // account they belong to is named only by the session cookie.
    expect((await res.json()).notifications[0].body).toBe('from 10.0.0.1');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the notification preferences return the settings with no-store', async () => {
    const repo = preferenceRepo();
    vi.mocked(repo.findByUser).mockResolvedValue([
      { typeKey: 'security', sse: true, push: false, email: true }
    ]);
    const d = deps();
    const res = await createPreferencesHandler(repo, registry()).GET(await authedEvent(d));
    expect(res.status).toBe(200);
    expect((await res.json()).preferences).toHaveLength(1);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the passkey inventory returns the credentials with no-store', async () => {
    const d = deps();
    const repo = d.repos.passkey as PasskeyRepository;
    vi.mocked(repo.findByUserId).mockResolvedValue([
      {
        credentialId: 'cred-abc',
        userId: 'user-1',
        publicKey: new Uint8Array(0),
        publicKeyAlg: -7,
        counter: 0,
        transports: ['internal'],
        aaguid: '00000000-0000-0000-0000-000000000000',
        name: 'MacBook',
        createdAt: new Date(),
        lastUsedAt: null
      }
    ]);
    const handlers = createPasskeyHandlers(d, {
      rpId: 'app.test',
      rpName: 'Test',
      origin: 'https://app.test',
      challengeStore: createInMemoryChallengeStore()
    });
    const res = await handlers.list.GET(await authedEvent(d));
    expect(res.status).toBe(200);
    expect((await res.json()).passkeys[0].name).toBe('MacBook');
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the SSE stream is uncacheable, not merely revalidated', async () => {
    // `no-cache` still permits a shared cache to STORE the response; only
    // `no-store` forbids it. A per-user event stream is as private as the rows
    // it carries.
    const d = deps();
    const res = await createStreamHandler(createSSEManager()).GET(await authedEvent(d));
    expect(res.headers.get('content-type')).toBe('text/event-stream');
    expect(res.headers.get('cache-control')).toBe('no-store');
    await res.body?.cancel();
  });
});

describe('cache directives — the headers a response must not lose', () => {
  it('a rate-limited refusal keeps Retry-After alongside the directive', async () => {
    const d = createMockAuthDeps({
      config: {
        appUrl: 'https://app.test',
        jwt: { secret: 'test-secret' },
        rateLimit: { login: { windowMs: 60_000, max: 1 } }
      },
      user: { findByEmail: vi.fn().mockResolvedValue(null) }
    });
    const login = createLoginHandler(d);
    const body = { email: 'a@b.test', password: 'irrelevant' };
    await login.POST(mockPostEvent(body) as unknown as RequestEvent);
    const res = await login.POST(mockPostEvent(body) as unknown as RequestEvent);

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('the JWKS document stays publicly cacheable', async () => {
    const es256 = await generateES256KeyPair();
    const res = await createJWKSHandler({
      jwt: { algorithm: 'ES256', signingKey: es256.privateKey, secret: 'unused' }
    }).GET(anonymousEvent());
    expect(res.status).toBe(200);
    expect((await res.json()).keys).toHaveLength(1);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('the password policy stays publicly cacheable', async () => {
    const res = await createPasswordPolicyHandler(deps()).GET(anonymousEvent());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });
});
