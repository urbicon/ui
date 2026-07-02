import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { PushSubscriptionRepository } from '../../adapters/types.js';
import { createPushSubscriptionHandler } from './push-subscription.js';

/**
 * The push-subscription endpoint persists a browser endpoint that the server
 * later fetches (web-push). Two properties matter and were untested (Cluster J):
 *  - SSRF guard: the endpoint is validated by `isAllowedPushEndpoint` before
 *    storage, so a private/loopback/non-HTTPS URL can't be smuggled in (the
 *    guard's own edge cases live in push-endpoint.test.ts; here we prove the
 *    handler actually wires it up, incl. the optional host allowlist).
 *  - IDOR: create/delete scope to `locals.user.id`, never a body-supplied id.
 */

const PUBLIC_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123';
// Structurally valid RFC 8291 keys: p256dh is a 65-byte uncompressed point
// (leading 0x04), auth is a 16-byte secret — base64url-encoded as the browser
// would send them.
const KEYS = {
  p256dh: Buffer.from([0x04, ...new Array(64).fill(1)]).toString('base64url'),
  auth: Buffer.from(new Array(16).fill(2)).toString('base64url')
};

function mockRepo(overrides: Partial<PushSubscriptionRepository> = {}): PushSubscriptionRepository {
  return {
    findByUser: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    delete: vi.fn(),
    ...overrides
  };
}

function event(body: unknown, user?: { id: string }): RequestEvent {
  return {
    request: new Request('http://localhost/api/notifications/push', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    locals: user ? { user } : {}
  } as unknown as RequestEvent;
}

describe('createPushSubscriptionHandler — POST', () => {
  it('returns 401 when unauthenticated', async () => {
    const repo = mockRepo();
    const res = await createPushSubscriptionHandler(repo).POST(
      event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } })
    );
    expect(res.status).toBe(401);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 400 when the subscription is missing endpoint or keys', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo);
    expect(
      (await handler.POST(event({ subscription: { endpoint: PUBLIC_ENDPOINT } }, { id: 'u1' })))
        .status
    ).toBe(400);
    expect((await handler.POST(event({ subscription: { keys: KEYS } }, { id: 'u1' }))).status).toBe(
      400
    );
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects an SSRF-prone endpoint (private/loopback/non-HTTPS) with 400 before storing', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo);
    for (const endpoint of [
      'https://169.254.169.254/latest/meta-data', // cloud-metadata link-local (the headline SSRF target)
      'https://10.0.0.1/push', // private range
      'http://fcm.googleapis.com/x', // non-HTTPS
      'https://127.0.0.1/push' // loopback
    ]) {
      const res = await handler.POST(
        event({ subscription: { endpoint, keys: KEYS } }, { id: 'u1' })
      );
      expect(res.status).toBe(400);
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('rejects structurally invalid encryption keys with 400 before storing', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo);
    for (const keys of [
      { p256dh: 'pub', auth: 'secret' }, // too short to decode to 65/16 bytes
      { p256dh: KEYS.p256dh }, // missing auth
      { p256dh: Buffer.from(new Array(65).fill(1)).toString('base64url'), auth: KEYS.auth }, // 65 bytes but no 0x04 prefix
      { p256dh: 123, auth: 456 } // non-strings
    ]) {
      const res = await handler.POST(
        event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys } }, { id: 'u1' })
      );
      expect(res.status).toBe(400);
    }
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('returns 400 (not 500) on a malformed JSON body', async () => {
    const repo = mockRepo();
    const ev = {
      request: new Request('http://localhost/api/notifications/push', {
        method: 'POST',
        body: 'not json',
        headers: { 'Content-Type': 'application/json' }
      }),
      locals: { user: { id: 'u1' } }
    } as unknown as RequestEvent;
    const res = await createPushSubscriptionHandler(repo).POST(ev);
    expect(res.status).toBe(400);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('stores a valid public HTTPS subscription scoped to the session user (201)', async () => {
    const repo = mockRepo();
    const res = await createPushSubscriptionHandler(repo).POST(
      // Hostile body claims another owner; the handler must use locals.
      event(
        { userId: 'victim-2', subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } },
        {
          id: 'owner-1'
        }
      )
    );
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith('owner-1', { endpoint: PUBLIC_ENDPOINT, keys: KEYS });
    expect(repo.create).not.toHaveBeenCalledWith('victim-2', expect.anything());
  });

  it('treats created/updated/reassigned outcomes as success (201)', async () => {
    for (const outcome of ['created', 'updated', 'reassigned'] as const) {
      const repo = mockRepo({ create: vi.fn().mockResolvedValue(outcome) });
      const res = await createPushSubscriptionHandler(repo).POST(
        event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
      );
      expect(res.status, `outcome '${outcome}' is a success`).toBe(201);
    }
  });

  it('surfaces a key-mismatch rejection as 409 without claiming success — and logs the security signal', async () => {
    // The repo refused the write: the endpoint row belongs to another account
    // and the submitted keys don't match (see PushSubscriptionRepository).
    const repo = mockRepo({ create: vi.fn().mockResolvedValue('rejected') });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const res = await createPushSubscriptionHandler(repo, { logger }).POST(
      event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'attacker' })
    );
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.success).toBeUndefined();
    expect(body.code, 'machine code distinguishes ownership from the device cap').toBe(
      'push_endpoint_conflict'
    );
    // Someone replaying foreign endpoint URLs is a signal the operator must
    // be able to see; the endpoint itself stays out of the line.
    const line = String(vi.mocked(logger.warn).mock.calls[0]?.[0]);
    expect(line).toContain('rejected');
    expect(line).toContain('attacker');
    expect(line).not.toContain(PUBLIC_ENDPOINT);
  });

  it('logs a reassign (a push channel moving between accounts must be correlatable)', async () => {
    const repo = mockRepo({ create: vi.fn().mockResolvedValue('reassigned') });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const res = await createPushSubscriptionHandler(repo, { logger }).POST(
      event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'next-user' })
    );
    expect(res.status).toBe(201);
    const line = String(vi.mocked(logger.warn).mock.calls[0]?.[0]);
    expect(line).toContain('reassigned');
    expect(line).not.toContain(PUBLIC_ENDPOINT);
  });

  it('warns once when the adapter predates the outcome contract (gate silently absent)', async () => {
    // A legacy adapter still returning Promise<void>: the takeover gate does
    // not exist there — the tripwire makes that visible instead of silent.
    const repo = mockRepo({ create: vi.fn().mockResolvedValue(undefined) });
    const logger = { warn: vi.fn(), error: vi.fn() };
    const handler = createPushSubscriptionHandler(repo, { logger });
    const post = () =>
      handler.POST(
        event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
      );
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    const tripwires = vi
      .mocked(logger.warn)
      .mock.calls.filter(([msg]) => String(msg).includes('returned no outcome'));
    expect(tripwires, 'warn once, not per request').toHaveLength(1);
  });

  it('rate-limits POST per user (429 past the limit, repo untouched)', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo, {
      rateLimit: { windowMs: 60_000, max: 2 }
    });
    const post = () =>
      handler.POST(
        event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
      );
    expect((await post()).status).toBe(201);
    expect((await post()).status).toBe(201);
    const limited = await post();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect((await limited.json()).code, 'the 429 carries the machine code').toBe('rate_limited');
    expect(repo.create).toHaveBeenCalledTimes(2);
  });

  it('caps subscriptions per user at 409 — but never blocks a re-subscribe of a known endpoint', async () => {
    const stored = Array.from({ length: 3 }, (_, i) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/device-${i}`,
      keys: KEYS
    }));
    const repo = mockRepo({ findByUser: vi.fn().mockResolvedValue(stored) });
    const handler = createPushSubscriptionHandler(repo, { maxSubscriptionsPerUser: 3 });

    // A NEW endpoint beyond the cap is refused without a write.
    const blocked = await handler.POST(
      event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
    );
    expect(blocked.status).toBe(409);
    expect((await blocked.json()).code).toBe('push_subscription_limit');
    expect(repo.create).not.toHaveBeenCalled();

    // Re-sending an already-stored endpoint (the browser's normal re-enable)
    // doesn't grow the count and must pass despite the full cap.
    const resubscribe = await handler.POST(
      event({ subscription: { endpoint: stored[0].endpoint, keys: KEYS } }, { id: 'u1' })
    );
    expect(resubscribe.status).toBe(201);
    expect(repo.create).toHaveBeenCalledWith('u1', { endpoint: stored[0].endpoint, keys: KEYS });
  });

  it('never blocks a device at cap−1 (boundary from below)', async () => {
    const stored = Array.from({ length: 2 }, (_, i) => ({
      endpoint: `https://fcm.googleapis.com/fcm/send/device-${i}`,
      keys: KEYS
    }));
    const repo = mockRepo({ findByUser: vi.fn().mockResolvedValue(stored) });
    const handler = createPushSubscriptionHandler(repo, { maxSubscriptionsPerUser: 3 });
    const res = await handler.POST(
      event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
    );
    expect(res.status).toBe(201);
    expect(repo.create).toHaveBeenCalled();
  });

  it('rateLimit: null disables limiting entirely (opt-out must not regress to the default)', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo, { rateLimit: null });
    // One past the built-in default of 10 — all must pass.
    for (let i = 0; i < 11; i++) {
      const res = await handler.POST(
        event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
      );
      expect(res.status).toBe(201);
    }
    expect(repo.create).toHaveBeenCalledTimes(11);
  });

  it('honours the optional host allowlist (rejects a public host not on it)', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo, {
      allowedEndpointHosts: ['fcm.googleapis.com']
    });
    // On the allowlist → accepted.
    expect(
      (
        await handler.POST(
          event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
        )
      ).status
    ).toBe(201);
    // Public, valid HTTPS, but not on the allowlist → rejected.
    expect(
      (
        await handler.POST(
          event(
            { subscription: { endpoint: 'https://evil-push.example.com/x', keys: KEYS } },
            { id: 'u1' }
          )
        )
      ).status
    ).toBe(400);
  });
});

describe('createPushSubscriptionHandler — DELETE', () => {
  it('shares one rate-limit budget with POST (mutation finding M2 of the test review)', async () => {
    const repo = mockRepo();
    const handler = createPushSubscriptionHandler(repo, {
      rateLimit: { windowMs: 60_000, max: 2 }
    });
    // Exhaust the budget with POSTs …
    for (let i = 0; i < 2; i++) {
      expect(
        (
          await handler.POST(
            event({ subscription: { endpoint: PUBLIC_ENDPOINT, keys: KEYS } }, { id: 'u1' })
          )
        ).status
      ).toBe(201);
    }
    // … then the DELETE must hit the same wall.
    const limited = await handler.DELETE(event({ endpoint: PUBLIC_ENDPOINT }, { id: 'u1' }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns 401 when unauthenticated', async () => {
    const repo = mockRepo();
    const res = await createPushSubscriptionHandler(repo).DELETE(
      event({ endpoint: PUBLIC_ENDPOINT })
    );
    expect(res.status).toBe(401);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('returns 400 when the endpoint is missing', async () => {
    const repo = mockRepo();
    const res = await createPushSubscriptionHandler(repo).DELETE(event({}, { id: 'u1' }));
    expect(res.status).toBe(400);
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('deletes scoped to the session user (cannot silence another user by endpoint)', async () => {
    const repo = mockRepo();
    const res = await createPushSubscriptionHandler(repo).DELETE(
      event({ userId: 'victim-2', endpoint: PUBLIC_ENDPOINT }, { id: 'owner-1' })
    );
    expect(res.status).toBe(200);
    expect(repo.delete).toHaveBeenCalledWith('owner-1', PUBLIC_ENDPOINT);
    expect(repo.delete).not.toHaveBeenCalledWith('victim-2', expect.anything());
  });
});
