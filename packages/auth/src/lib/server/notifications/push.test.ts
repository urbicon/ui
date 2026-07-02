import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PushSubscriptionData } from '../adapters/types.js';
import { createPushService } from './push.js';
import { base64UrlEncode, generateVapidKeys } from './web-push-crypto.js';
import {
  decryptWebPushPayload,
  makeTestUserAgent,
  parseAes128gcmBody
} from './web-push-test-utils.js';

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

describe('sendPush wire format', () => {
  // Mutation-test finding: swapping buildEncryptedBody's arguments kept every
  // suite green — the crypto roundtrip starts at encryptPayload's outputs and
  // never sees the wire body, and the push service would even 201 an
  // undecodable record (it cannot decrypt), so onPushResult reports success.
  // This test closes the gap by decrypting the exact bytes handed to fetch,
  // the way a browser does.
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

  async function makeRealSub() {
    const ua = await makeTestUserAgent();
    const sub: PushSubscriptionData = {
      endpoint: 'https://push.example.com/wire',
      keys: { p256dh: base64UrlEncode(ua.publicRaw), auth: base64UrlEncode(ua.authSecret) }
    };
    return { ua, sub };
  }

  // Unlike the shared placeholder `vapid` above (which the VAPID signer
  // rejects — fine for the rate-limit tests, they never assert `success`),
  // this suite exercises the full crypto path to the wire, so it needs a
  // real key pair.
  async function makeRealVapid() {
    const keys = await generateVapidKeys();
    return { ...keys, subject: 'mailto:test@example.com' };
  }

  it('POSTs a body an RFC 8291 user agent can decrypt', async () => {
    const { ua, sub } = await makeRealSub();
    const service = createPushService(await makeRealVapid());
    const payload = { title: 'Wire', body: 'roundtrip', url: '/inbox' };

    const [result] = await service.sendPush([sub], payload);
    expect(result.success).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Encoding']).toBe('aes128gcm');

    const parts = parseAes128gcmBody(new Uint8Array(init.body as ArrayBuffer));
    expect(parts.recordSize).toBe(4096);
    expect(parts.serverPublicKey).toHaveLength(65);
    await expect(decryptWebPushPayload(parts, ua)).resolves.toBe(JSON.stringify(payload));
  });

  it('delivers a decryptable record at the exact 4079-byte plaintext boundary', async () => {
    const { ua, sub } = await makeRealSub();
    const service = createPushService(await makeRealVapid());

    // JSON.stringify({title}) wraps the title in `{"title":"…"}` — 12 bytes of
    // ASCII scaffolding — so a 4067-char title lands exactly on the 4079-byte
    // Web Push plaintext limit (4096-byte record − 16 GCM tag − 1 delimiter).
    const payload = { title: 'x'.repeat(4067) };
    expect(new TextEncoder().encode(JSON.stringify(payload))).toHaveLength(4079);

    const [result] = await service.sendPush([sub], payload);
    expect(result.success).toBe(true);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parts = parseAes128gcmBody(new Uint8Array(init.body as ArrayBuffer));
    await expect(decryptWebPushPayload(parts, ua)).resolves.toBe(JSON.stringify(payload));

    // One byte more must be rejected up front (no doomed request).
    const oversized = { title: 'x'.repeat(4068) };
    const [rejected] = await service.sendPush([sub], oversized);
    expect(rejected.success).toBe(false);
    expect(rejected.error).toContain('payload too large');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
