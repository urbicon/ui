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
