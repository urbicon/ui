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
import type { AuthDeps } from '../deps.js';
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
import { hashPassword } from '../password.js';
import { issueRefreshToken } from '../refresh-token.js';
import { setSessionCookie } from '../session.js';
import {
  createMockAuthDeps,
  createMockInvitation,
  createMockUser,
  mockPostEvent
} from '../test-utils.js';
import { ENDPOINT_KEYS, isWrappedEndpoint } from './_shared.js';
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
 * `Response` that comes back.
 *
 * It is driven in two event forms, and the second is the load-bearing one: an
 * unauthenticated request reaches a refusal, which `authError` covers on its
 * own, so that run stays green even with `privateEndpoints` removed entirely.
 * The signed-in run is what a factory returning its bundle unwrapped fails.
 *
 * Both halves of completeness are derived rather than listed: {@link BUNDLES}
 * is checked against the factory exports of `../index.js`, and the verbs are
 * discovered by walking each constructed bundle. A new endpoint is therefore
 * covered without editing a list here, and a new *factory* fails the coverage
 * test by name until it is built above.
 */

// The endpoint keys come from `_shared.ts` — the same list `privateEndpoints`
// walks. A second copy here could disagree with it, and the endpoints it did
// not name would be invisible to both.

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
    if (ENDPOINT_KEYS.includes(key) && typeof value === 'function') {
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
function gateDeps() {
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
async function buildBundles(): Promise<{
  bundles: Record<string, unknown>;
  deps: ReturnType<typeof gateDeps>;
}> {
  const d = gateDeps();
  const es256 = await generateES256KeyPair();
  const service = createNotificationService({
    registry: registry(),
    sse: createSSEManager(),
    repos: { notification: notificationRepo() }
  });

  const bundles = {
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
  return { bundles, deps: d };
}

const { bundles: BUNDLES, deps: GATE_DEPS } = await buildBundles();
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

/**
 * A signed-in request, carrying both ways this package identifies a caller: a
 * session cookie minted against {@link GATE_DEPS} (`requireSessionUser`) and
 * `locals.user` (`localsUserId`, set by the auth handle on the notification
 * endpoints).
 */
async function authenticatedEvent(): Promise<RequestEvent> {
  const ev = mockPostEvent({});
  await setSessionCookie(
    ev.cookies as unknown as Cookies,
    { userId: 'user-1', email: 'test@test.com', role: 'admin', tokenVersion: 0 } as never,
    GATE_DEPS.config.jwt
  );
  return {
    ...ev,
    params: {},
    locals: { user: { id: 'user-1', email: 'test@test.com', role: 'admin' } }
  } as unknown as RequestEvent;
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

/**
 * Every endpoint came out of `privateEndpoints`.
 *
 * The two driven sweeps below can only speak for the endpoints they reach on a
 * success path: 13 of the 41 need a ceremony, a second factor or a live token
 * first, and on their refusal path the directive comes from `authError`, which
 * says nothing about the wrapper. This asks the wrapper directly instead, so it
 * covers all 41 with no fixture — and it is what catches an endpoint mounted
 * BESIDE the wrapper rather than inside it, which no per-bundle argument can:
 * `{ ...privateEndpoints({ setup }), enable: enableHandler(deps) }` leaves
 * `enable` answering 200 with ten plaintext backup codes and no directive.
 *
 * It claims less than the sweeps do — that the function came from the wrapper,
 * not that a particular response carries a particular header. The three public
 * endpoints are wrapped too; the wrapper simply finds their directive already
 * set and leaves it. Both halves are asserted, so neither stands in for the
 * other.
 */
describe('cache directives — every endpoint is wrapped', () => {
  it.each(ENDPOINTS.map((e) => [e.id, e] as const))('%s came from the wrapper', (_id, endpoint) => {
    expect(isWrappedEndpoint(endpoint.run)).toBe(true);
  });

  it('holds for the public endpoints, which set their own directive', async () => {
    const publicEndpoints = ENDPOINTS.filter((e) => e.id in STORABLE);
    // Guards the filter itself: an empty list would make the loop vacuous.
    expect(publicEndpoints.map((e) => e.id).sort()).toEqual(Object.keys(STORABLE).sort());

    for (const endpoint of publicEndpoints) {
      expect(isWrappedEndpoint(endpoint.run), `${endpoint.id} is not wrapped`).toBe(true);
      const res = await endpoint.run(anonymousEvent());
      await res.body?.cancel();
      // Wrapped AND public: being wrapped did not overwrite what they name.
      expect(res.headers.get('cache-control'), endpoint.id).toBe(STORABLE[endpoint.id]);
    }
  });

  it('is not true of a handler that never went through it', () => {
    expect(isWrappedEndpoint(async () => new Response('x'))).toBe(false);
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

/**
 * The same sweep under a signed-in request, and the half that actually tests
 * the wrapper.
 *
 * An unauthenticated request reaches most endpoints' refusal, and a refusal
 * takes its directive from `authError` — so the run above passes with
 * `privateEndpoints` deleted outright, and a factory that forgets the wrapper
 * goes unnoticed. Signing in moves most endpoints onto the path where the
 * bundle is the only thing supplying the header, `2xx` bodies included: the
 * updated profile, the TOTP secret, the account payloads.
 */
describe('cache directives — every endpoint, signed in', () => {
  it.each(ENDPOINTS.map((e) => [e.id, e] as const))(
    '%s carries a cache directive',
    async (id, endpoint) => {
      const res = await endpoint.run(await authenticatedEvent());
      await res.body?.cancel();
      expect(res.headers.get('cache-control')).toBe(STORABLE[id] ?? 'no-store');
    }
  );
});

/**
 * One success response per factory, driven to a 2xx.
 *
 * **This is the half that tests the wrapper.** `authError` never answers 2xx,
 * so a 2xx carrying `no-store` can only have taken it from `privateEndpoints`
 * around the bundle — which makes each entry below a proof that its factory is
 * wrapped, and with it every endpoint under that factory: the wrapper walks the
 * whole bundle in one pass, so a group it reached at all it reached completely.
 *
 * The table is keyed by factory export name and checked against {@link BUNDLES},
 * so a new factory fails here until someone drives its success path. Without
 * this, coverage rests on the refusal sweep — and a refusal takes its directive
 * from `authError`, which leaves the wrapper untested: with `privateEndpoints`
 * emptied out, the refusal sweep loses three assertions out of 41, and a single
 * factory dropping the wrapper loses none at all.
 */
const PASSWORD = 'Correct-Horse-Battery-42';
const NEW_PASSWORD = 'Tr0ub4dor-and-3-More';
const ENC_KEY = 'test-2fa-encryption-key-0123456789';
const SESSION = {
  userId: 'user-1',
  email: 'test@test.com',
  role: 'admin',
  tokenVersion: 0
} as never;

/** Deps whose session user carries a real password hash, so re-auth gates pass. */
async function signedInDeps(opts?: {
  user?: Partial<Parameters<typeof createMockAuthDeps>[0] extends undefined ? never : object>;
  userRepo?: Record<string, unknown>;
  invitation?: Record<string, unknown>;
  refreshToken?: ReturnType<typeof createInMemoryRefreshTokenRepository>;
}) {
  const sessionUser = createMockUser({ id: 'user-1', passwordHash: await hashPassword(PASSWORD) });
  const deps = createMockAuthDeps({
    config: {
      appUrl: 'https://app.test',
      jwt: { secret: 'test-secret', expiresIn: '1h' },
      refreshToken: {},
      twoFactor: { encryptionKey: ENC_KEY }
    },
    user: { findById: vi.fn().mockResolvedValue(sessionUser), ...opts?.userRepo },
    invitation: opts?.invitation,
    refreshToken: opts?.refreshToken ?? createInMemoryRefreshTokenRepository(createInMemoryStore()),
    passkey: passkeyRepo()
  });
  return { deps, sessionUser };
}

/** An event signed in against `d`, carrying an optional body, params and cookies. */
async function signedIn(
  d: AuthDeps<string>,
  opts?: { body?: unknown; params?: Record<string, string>; cookies?: Record<string, string> }
): Promise<RequestEvent> {
  const ev = mockPostEvent(opts?.body ?? {});
  await setSessionCookie(ev.cookies as unknown as Cookies, SESSION, d.config.jwt);
  for (const [name, value] of Object.entries(opts?.cookies ?? {})) ev.cookies.set(name, value);
  return {
    ...ev,
    params: opts?.params ?? {},
    locals: { user: { id: 'user-1', email: 'test@test.com', role: 'admin' } }
  } as unknown as RequestEvent;
}

const SUCCESS_DRIVES: Record<string, { endpoint: string; run: () => Promise<Response> }> = {
  createChangeEmailHandler: {
    endpoint: 'ChangeEmail.POST',
    run: async () => {
      const { deps } = await signedInDeps({
        userRepo: { findByEmail: vi.fn().mockResolvedValue(null) }
      });
      return createChangeEmailHandler(deps).POST(
        await signedIn(deps, { body: { newEmail: 'new@test.com', currentPassword: PASSWORD } })
      );
    }
  },
  createChangePasswordHandler: {
    endpoint: 'ChangePassword.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createChangePasswordHandler(deps).POST(
        await signedIn(deps, { body: { currentPassword: PASSWORD, newPassword: NEW_PASSWORD } })
      );
    }
  },
  createDeleteAccountHandler: {
    endpoint: 'DeleteAccount.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createDeleteAccountHandler(deps).POST(
        await signedIn(deps, { body: { currentPassword: PASSWORD } })
      );
    }
  },
  createForgotPasswordHandler: {
    endpoint: 'ForgotPassword.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createForgotPasswordHandler(deps).POST(
        await signedIn(deps, { body: { email: 'test@test.com' } })
      );
    }
  },
  createInvitationHandlers: {
    endpoint: 'Invitation.GET',
    run: async () => {
      const { deps } = await signedInDeps({ invitation: { list: vi.fn().mockResolvedValue([]) } });
      return createInvitationHandlers(deps, { authorize: () => true, roles: ['admin'] }).GET(
        await signedIn(deps)
      );
    }
  },
  createJWKSHandler: {
    endpoint: 'JWKS.GET',
    run: async () => {
      const es256 = await generateES256KeyPair();
      return createJWKSHandler({
        jwt: { algorithm: 'ES256', signingKey: es256.privateKey, secret: 'unused' }
      }).GET(anonymousEvent());
    }
  },
  createLoginHandler: {
    endpoint: 'Login.POST',
    run: async () => {
      const { deps, sessionUser } = await signedInDeps({
        userRepo: { findByEmail: vi.fn().mockResolvedValue(undefined) }
      });
      vi.mocked(deps.repos.user.findByEmail).mockResolvedValue(sessionUser);
      return createLoginHandler(deps).POST(
        await signedIn(deps, { body: { email: 'test@test.com', password: PASSWORD } })
      );
    }
  },
  createLogoutHandler: {
    endpoint: 'Logout.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createLogoutHandler(deps).POST(await signedIn(deps));
    }
  },
  createMeHandler: {
    endpoint: 'Me.GET',
    run: async () => {
      const { deps } = await signedInDeps();
      return createMeHandler(deps).GET(await signedIn(deps));
    }
  },
  createPasswordPolicyHandler: {
    endpoint: 'PasswordPolicy.GET',
    run: async () => {
      const { deps } = await signedInDeps();
      return createPasswordPolicyHandler(deps).GET(anonymousEvent());
    }
  },
  createRefreshHandler: {
    endpoint: 'Refresh.POST',
    run: async () => {
      const repo = createInMemoryRefreshTokenRepository(createInMemoryStore());
      const { token } = await issueRefreshToken(repo, 'user-1', { refreshTokenTtl: '30d' });
      const { deps } = await signedInDeps({ refreshToken: repo });
      return createRefreshHandler(deps).POST(await signedIn(deps, { cookies: { refresh: token } }));
    }
  },
  createRegisterHandler: {
    endpoint: 'Register.POST',
    run: async () => {
      const token = 'invitation-token';
      const sessionUser = createMockUser({ id: 'user-1' });
      const { deps } = await signedInDeps({
        // Called twice on the success path: null for the "already registered?"
        // check, then the created row, which the handler re-reads rather than
        // hand-assembling.
        userRepo: {
          findByEmail: vi.fn().mockResolvedValueOnce(null).mockResolvedValue(sessionUser)
        },
        invitation: {
          findByTokenHash: vi
            .fn()
            .mockResolvedValue(createMockInvitation({ email: 'new@test.com' }))
        }
      });
      vi.mocked(deps.repos.user.create).mockResolvedValue(sessionUser);
      return createRegisterHandler(deps).POST(
        await signedIn(deps, {
          body: { email: 'new@test.com', name: 'New User', password: NEW_PASSWORD, token }
        })
      );
    }
  },
  createResetPasswordHandler: {
    endpoint: 'ResetPassword.POST',
    run: async () => {
      const { deps, sessionUser } = await signedInDeps();
      vi.mocked(deps.repos.user.consumeResetToken).mockResolvedValue(sessionUser);
      return createResetPasswordHandler(deps).POST(
        await signedIn(deps, { body: { token: 'reset-token', password: NEW_PASSWORD } })
      );
    }
  },
  createSessionsHandlers: {
    endpoint: 'Sessions.list.GET',
    run: async () => {
      const { deps } = await signedInDeps();
      return createSessionsHandlers(deps).list.GET(await signedIn(deps));
    }
  },
  createTwoFactorHandlers: {
    endpoint: 'TwoFactor.setup.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createTwoFactorHandlers(deps).setup.POST(await signedIn(deps));
    }
  },
  createUpdateProfileHandler: {
    endpoint: 'UpdateProfile.POST',
    run: async () => {
      const { deps } = await signedInDeps();
      return createUpdateProfileHandler(deps).POST(
        await signedIn(deps, { body: { name: 'New Name' } })
      );
    }
  },
  createVerifyEmailChangeHandler: {
    endpoint: 'VerifyEmailChange.POST',
    run: async () => {
      const { deps, sessionUser } = await signedInDeps();
      vi.mocked(deps.repos.user.consumeEmailChangeToken).mockResolvedValue(sessionUser);
      return createVerifyEmailChangeHandler(deps).POST(
        await signedIn(deps, { body: { token: 'change-token' } })
      );
    }
  },
  createVerifyEmailHandler: {
    endpoint: 'VerifyEmail.POST',
    run: async () => {
      const { deps, sessionUser } = await signedInDeps();
      vi.mocked(deps.repos.user.consumeVerificationToken).mockResolvedValue(sessionUser);
      return createVerifyEmailHandler(deps).POST(
        await signedIn(deps, { body: { token: 'verify-token' } })
      );
    }
  },
  createNotificationsHandlers: {
    endpoint: 'Notifications.list.GET',
    run: async () => {
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
      const { deps } = await signedInDeps();
      return createNotificationsHandlers(service).list.GET(await signedIn(deps));
    }
  },
  createPreferencesHandler: {
    endpoint: 'Preferences.GET',
    run: async () => {
      const repo = preferenceRepo();
      vi.mocked(repo.findByUser).mockResolvedValue([
        { typeKey: 'security', sse: true, push: false, email: true }
      ]);
      const { deps } = await signedInDeps();
      return createPreferencesHandler(repo, registry()).GET(await signedIn(deps));
    }
  },
  createPushKeyHandler: {
    endpoint: 'PushKey.GET',
    run: async () => createPushKeyHandler(VAPID_PUBLIC_KEY).GET(anonymousEvent())
  },
  createPushSubscriptionHandler: {
    endpoint: 'PushSubscription.DELETE',
    run: async () => {
      const { deps } = await signedInDeps();
      return createPushSubscriptionHandler(pushSubscriptionRepo()).DELETE(
        await signedIn(deps, { body: { endpoint: 'https://push.test/endpoint' } })
      );
    }
  },
  createStreamHandler: {
    endpoint: 'Stream.GET',
    run: async () => {
      const { deps } = await signedInDeps();
      return createStreamHandler(createSSEManager()).GET(await signedIn(deps));
    }
  },
  createPasskeyHandlers: {
    endpoint: 'Passkey.list.GET',
    run: async () => {
      const { deps } = await signedInDeps();
      const repo = deps.repos.passkey as PasskeyRepository;
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
      return createPasskeyHandlers(deps, {
        rpId: 'app.test',
        rpName: 'Test',
        origin: 'https://app.test',
        challengeStore: createInMemoryChallengeStore()
      }).list.GET(await signedIn(deps));
    }
  }
};

describe('cache directives — a success response per factory', () => {
  it('drives every factory the package exports', () => {
    expect(Object.keys(SUCCESS_DRIVES).sort()).toEqual(Object.keys(BUNDLES).sort());
  });

  it.each(Object.entries(SUCCESS_DRIVES))(
    '%s answers 2xx with the directive its bundle supplies',
    async (name, { endpoint, run }) => {
      // The endpoint id is declared, not synthesised from the factory name: the
      // drive picks a verb, and a STORABLE entry for a non-GET endpoint has to
      // be able to match it.
      expect(
        ENDPOINTS.map((e) => e.id),
        `${name} names an endpoint that does not exist`
      ).toContain(endpoint);
      const res = await run();
      await res.body?.cancel();
      // A 2xx is the whole point: `authError` cannot produce one, so the
      // directive below has no other source than the bundle wrapper.
      expect(res.status, `${name} did not reach a success path`).toBeGreaterThanOrEqual(200);
      expect(res.status, `${name} did not reach a success path`).toBeLessThan(300);
      expect(res.headers.get('cache-control')).toBe(STORABLE[endpoint] ?? 'no-store');
    }
  );
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
    const res = await createPasswordPolicyHandler(gateDeps()).GET(anonymousEvent());
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
  });
});
