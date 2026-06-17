import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleNotificationClick } from './index.js';

/**
 * The service-worker notification-click handler navigates to a URL pulled from
 * the (VAPID-signed, encrypted) push payload. Defense-in-depth requires it to
 * (a) refuse non-http(s) schemes — a `javascript:` URL would otherwise run in
 * the page origin via `client.navigate()` — and (b) match existing windows by
 * parsed origin, not a substring that a look-alike host could satisfy.
 */

const ORIGIN = 'https://app.example.com';

function makeEvent(url: unknown) {
  const waited: Promise<unknown>[] = [];
  const event = {
    notification: { close: vi.fn(), data: { url } },
    waitUntil: (p: Promise<unknown>) => void waited.push(p)
  } as unknown as NotificationEvent;
  return { event, settle: () => Promise.all(waited) };
}

describe('handleNotificationClick', () => {
  let openWindow: ReturnType<typeof vi.fn>;
  let matchAll: ReturnType<typeof vi.fn>;

  function stubSelf(
    clients: Array<{
      url: string;
      focus: ReturnType<typeof vi.fn>;
      navigate: ReturnType<typeof vi.fn>;
    }>
  ) {
    openWindow = vi.fn(async () => null);
    matchAll = vi.fn(async () => clients);
    vi.stubGlobal('self', {
      location: { origin: ORIGIN },
      clients: { matchAll, openWindow }
    });
  }

  beforeEach(() => stubSelf([]));
  afterEach(() => vi.unstubAllGlobals());

  it('ignores a javascript: URL (no navigate, no openWindow)', async () => {
    const client = { url: `${ORIGIN}/`, focus: vi.fn(), navigate: vi.fn() };
    stubSelf([client]);
    const { event, settle } = makeEvent('javascript:alert(1)');
    handleNotificationClick(event);
    await settle();
    expect(client.navigate).not.toHaveBeenCalled();
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('ignores an empty/absent URL', async () => {
    const { event, settle } = makeEvent(undefined);
    handleNotificationClick(event);
    await settle();
    expect(matchAll).not.toHaveBeenCalled();
  });

  it('navigates an existing same-origin window to the target', async () => {
    const client = { url: `${ORIGIN}/dashboard`, focus: vi.fn(), navigate: vi.fn() };
    stubSelf([client]);
    const { event, settle } = makeEvent(`${ORIGIN}/alerts/42`);
    handleNotificationClick(event);
    await settle();
    expect(client.focus).toHaveBeenCalled();
    expect(client.navigate).toHaveBeenCalledWith(`${ORIGIN}/alerts/42`);
    expect(openWindow).not.toHaveBeenCalled();
  });

  it('does NOT treat a look-alike host as same-origin (opens a new window instead)', async () => {
    const evil = { url: 'https://app.example.com.evil.test/', focus: vi.fn(), navigate: vi.fn() };
    stubSelf([evil]);
    const { event, settle } = makeEvent(`${ORIGIN}/alerts/42`);
    handleNotificationClick(event);
    await settle();
    expect(evil.navigate).not.toHaveBeenCalled();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/alerts/42`);
  });

  it('opens a new window when no window is open', async () => {
    stubSelf([]);
    const { event, settle } = makeEvent(`${ORIGIN}/alerts/42`);
    handleNotificationClick(event);
    await settle();
    expect(openWindow).toHaveBeenCalledWith(`${ORIGIN}/alerts/42`);
  });
});
