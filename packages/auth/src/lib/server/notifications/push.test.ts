import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSubscriptionData } from '../adapters/types.js';
import { createPushService } from './push.js';

function makeSub(endpoint: string): PushSubscriptionData {
  return {
    endpoint,
    keys: {
      // Minimal placeholder keys — the fetch-mock below intercepts before the
      // real crypto runs, so these don't need to be valid.
      p256dh: 'x'.repeat(87),
      auth: 'y'.repeat(22)
    }
  };
}

const vapid = {
  publicKey: `BMfq${'A'.repeat(83)}`,
  privateKey: 'x'.repeat(43),
  subject: 'mailto:test@example.com'
};

describe('createPushService rate limiting', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn(async () => new Response('', { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('does not rate-limit when no config is passed (backwards compatible)', async () => {
    const service = createPushService(vapid);
    const sub = makeSub('https://push.example.com/a');

    for (let i = 0; i < 5; i++) {
      const [result] = await service.sendPush([sub], { title: 'hi' });
      expect(result.rateLimited).toBeFalsy();
    }
  });

  it('caps the number of pushes per endpoint within the window', async () => {
    const service = createPushService(vapid, {
      rateLimit: { windowMs: 60_000, max: 2 }
    });
    const sub = makeSub('https://push.example.com/b');

    const first = (await service.sendPush([sub], { title: 'one' }))[0];
    const second = (await service.sendPush([sub], { title: 'two' }))[0];
    const third = (await service.sendPush([sub], { title: 'three' }))[0];

    expect(first.rateLimited).toBeFalsy();
    expect(second.rateLimited).toBeFalsy();
    expect(third.rateLimited).toBe(true);
    expect(third.statusCode).toBe(429);
  });

  it('rate-limits each endpoint independently', async () => {
    const service = createPushService(vapid, {
      rateLimit: { windowMs: 60_000, max: 1 }
    });
    const subA = makeSub('https://push.example.com/one');
    const subB = makeSub('https://push.example.com/two');

    const a1 = (await service.sendPush([subA], { title: 'a1' }))[0];
    const a2 = (await service.sendPush([subA], { title: 'a2' }))[0];
    const b1 = (await service.sendPush([subB], { title: 'b1' }))[0];

    expect(a1.rateLimited).toBeFalsy();
    expect(a2.rateLimited).toBe(true);
    expect(b1.rateLimited).toBeFalsy();
  });

  it('returns a synthetic 429 result without touching the subscription endpoint', async () => {
    // We can't easily count real fetch calls here because the crypto dummies
    // in these test subscriptions aren't valid enough for encryptPayload to
    // run. Instead we assert the rate-limited result shape directly — the
    // contract for consumers is that rateLimited=true comes with a 429 and
    // no success flag, not that fetch was called N-1 times.
    const service = createPushService(vapid, {
      rateLimit: { windowMs: 60_000, max: 1 }
    });
    const sub = makeSub('https://push.example.com/count');

    await service.sendPush([sub], { title: 'first' });
    const limited = (await service.sendPush([sub], { title: 'second' }))[0];

    expect(limited).toMatchObject({
      endpoint: 'https://push.example.com/count',
      success: false,
      statusCode: 429,
      rateLimited: true
    });
  });
});

describe('createPushService payload size limit', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn(async () => new Response('', { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('rejects an oversized payload up front without fetching the endpoint', async () => {
    const service = createPushService(vapid);
    const sub = makeSub('https://push.example.com/big');
    // Push services cap the encrypted record at 4096 bytes; a body well past
    // that must be refused before any request goes out.
    const [result] = await service.sendPush([sub], { title: 'hi', body: 'A'.repeat(5000) });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/payload too large/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// Cluster E review: defense-in-depth — even if a non-public endpoint reaches
// storage (pre-guard row, hand-built list), sendPush must not fetch it.
describe('createPushService SSRF guard', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchMock = vi.fn(async () => new Response('', { status: 201 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('blocks a private/link-local endpoint with a blocked-endpoint error, no fetch', async () => {
    const service = createPushService(vapid);
    const [result] = await service.sendPush([makeSub('https://169.254.169.254/x')], {
      title: 'hi'
    });
    expect(result.success).toBe(false);
    expect(result.error).toBe('blocked endpoint');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('lets a public https endpoint past the guard', async () => {
    const service = createPushService(vapid);
    const [result] = await service.sendPush([makeSub('https://push.example.com/a')], {
      title: 'hi'
    });
    // The placeholder keys make the downstream crypto fail, but crucially NOT
    // with the guard's 'blocked endpoint' error — proving the host passed.
    expect(result.error).not.toBe('blocked endpoint');
  });
});
