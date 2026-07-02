import { afterEach, describe, expect, it, vi } from 'vitest';
import { subscribeToPush } from './service-worker.js';

/**
 * subscribeToPush's discriminated result exists so that a broken VAPID key, a
 * dead push service, or a missing service worker can never be mistaken for
 * the user declining the permission prompt (silent-failure finding H1: with
 * `null` for everything, a wrong PUBLIC_VAPID_KEY looked like 100% of users
 * saying no). These tests pin each branch with stubbed browser globals.
 */

// A structurally valid base64url VAPID key (65 decodable bytes).
const VAPID = Buffer.from([0x04, ...new Array(64).fill(7)]).toString('base64url');

function stubBrowser(overrides: {
  ready?: Promise<unknown>;
  getSubscription?: () => Promise<unknown>;
  subscribe?: (opts: unknown) => Promise<unknown>;
  notificationPermission?: NotificationPermission;
}) {
  const registration = {
    pushManager: {
      getSubscription: overrides.getSubscription ?? (async () => null),
      subscribe: overrides.subscribe ?? (async () => ({ fake: 'subscription' }))
    }
  };
  vi.stubGlobal('navigator', {
    serviceWorker: { ready: overrides.ready ?? Promise.resolve(registration) }
  });
  vi.stubGlobal('window', { PushManager: class {} });
  vi.stubGlobal('Notification', { permission: overrides.notificationPermission ?? 'default' });
  return registration;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('subscribeToPush', () => {
  it("returns 'unsupported' when the browser has no service worker / Push API", async () => {
    vi.stubGlobal('navigator', {});
    vi.stubGlobal('window', {});
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'unsupported' });
  });

  it("returns 'subscribed' with the existing subscription when one is present", async () => {
    const existing = { endpoint: 'https://push.test/e1' };
    stubBrowser({ getSubscription: async () => existing });
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'subscribed', subscription: existing });
  });

  it("returns 'subscribed' with a fresh subscription otherwise", async () => {
    const fresh = { endpoint: 'https://push.test/e2' };
    const subscribe = vi.fn(async () => fresh);
    stubBrowser({ subscribe });
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'subscribed', subscription: fresh });
    expect(subscribe).toHaveBeenCalledWith(
      expect.objectContaining({ userVisibleOnly: true, applicationServerKey: expect.anything() })
    );
  });

  it("returns 'denied' when the user declines (NotAllowedError)", async () => {
    stubBrowser({
      subscribe: async () => {
        throw new DOMException('User denied permission', 'NotAllowedError');
      }
    });
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'denied' });
  });

  it("returns 'denied' when the permission state says so, whatever error shape the browser threw", async () => {
    stubBrowser({
      subscribe: async () => {
        throw new Error('some browser-specific refusal');
      },
      notificationPermission: 'denied'
    });
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'denied' });
  });

  it("returns 'error' (NOT 'denied') for a malformed VAPID key — a config error must not look like a user decision", async () => {
    stubBrowser({});
    const result = await subscribeToPush('!!!not-base64url!!!');
    expect(result.status).toBe('error');
  });

  it("returns 'error' with the cause when the push service fails", async () => {
    const boom = new DOMException('push service unreachable', 'AbortError');
    stubBrowser({
      subscribe: async () => {
        throw boom;
      }
    });
    expect(await subscribeToPush(VAPID)).toEqual({ status: 'error', error: boom });
  });

  it("returns 'error' when serviceWorker.ready never settles (no worker registered)", async () => {
    // `ready` never resolves without a registration — the timeout converts
    // the silent forever-hang into a diagnosable error.
    stubBrowser({ ready: new Promise(() => {}) });
    const result = await subscribeToPush(VAPID, { readyTimeoutMs: 20 });
    expect(result.status).toBe('error');
    expect(String((result as { error: unknown }).error)).toMatch(/never became ready/);
  });
});
