import { describe, expect, it, vi } from 'vitest';
import type { NotificationRecord } from '../../server/adapters/types.js';
import { createAuthStore } from './auth.svelte.js';
import { createNotificationStore } from './notifications.svelte.js';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

function fetcherReturning(...responses: Array<Response | Error>): typeof globalThis.fetch {
  const queue = [...responses];
  return vi.fn(async () => {
    const next = queue.shift();
    if (!next) throw new Error('fetcher queue exhausted');
    if (next instanceof Error) throw next;
    return next;
  }) as unknown as typeof globalThis.fetch;
}

const user = { id: 'u1', email: 'a@b.c', name: 'A', role: 'USER', emailVerified: true };

describe('createAuthStore', () => {
  it('login success populates the user', async () => {
    const store = createAuthStore({ fetcher: fetcherReturning(jsonResponse(200, { user })) });
    const result = await store.login('a@b.c', 'pw');
    expect(result).toEqual({ success: true });
    expect(store.user?.id).toBe('u1');
    expect(store.isAuthenticated).toBe(true);
  });

  it('login failure surfaces the wire contract (code + prose) instead of a hardcoded string', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(
        jsonResponse(401, { error: 'Invalid email or password.', code: 'invalid_credentials' })
      )
    });
    const result = await store.login('a@b.c', 'wrong');
    expect(result).toEqual({
      success: false,
      error: 'Invalid email or password.',
      code: 'invalid_credentials'
    });
    expect(store.user).toBeNull();
  });

  it('login with 2FA pending sets twoFactorRequired without a user', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { twoFactorRequired: true }),
        jsonResponse(200, { user })
      )
    });
    const result = await store.login('a@b.c', 'pw');
    expect(result).toEqual({ success: true, twoFactorRequired: true });
    expect(store.twoFactorRequired).toBe(true);
    expect(store.user).toBeNull();

    const verified = await store.verifyTwoFactor('123456');
    expect(verified).toEqual({ success: true });
    expect(store.twoFactorRequired).toBe(false);
    expect(store.user?.id).toBe('u1');
  });

  it('a request that never reaches the server yields the synthesized network_error code', async () => {
    const store = createAuthStore({ fetcher: fetcherReturning(new Error('offline')) });
    const result = await store.login('a@b.c', 'pw');
    expect(result).toEqual({ success: false, code: 'network_error' });
  });

  it('a non-JSON failure body degrades to a code-less failure instead of throwing', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(new Response('<html>bad gateway</html>', { status: 502 }))
    });
    const result = await store.register('A', 'a@b.c', 'pw');
    expect(result.success).toBe(false);
    expect(result.code).toBeUndefined();
    expect(result.error).toBeUndefined();
  });

  it('logout clears local state even when the server call fails, and reports the failure', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(jsonResponse(200, { user }), new Error('offline'))
    });
    await store.login('a@b.c', 'pw');
    expect(store.user).not.toBeNull();

    const result = await store.logout();
    expect(result).toEqual({ success: false, code: 'network_error' });
    expect(store.user).toBeNull();
    expect(store.isAuthenticated).toBe(false);
  });

  it('checkStatus resolves the session user through the injected fetcher', async () => {
    const store = createAuthStore({ fetcher: fetcherReturning(jsonResponse(200, { user })) });
    await store.checkStatus();
    expect(store.user?.id).toBe('u1');
    expect(store.loading).toBe(false);
  });

  it('checkStatus resolves the me-contract 401 as an answered "signed out"', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(jsonResponse(200, { user }), jsonResponse(401, { user: null }))
    });
    await store.checkStatus();
    expect(store.user).not.toBeNull();

    const result = await store.checkStatus();
    expect(result).toEqual({ success: true });
    expect(store.user).toBeNull();
  });

  it('checkStatus keeps the current user when the probe cannot be answered', async () => {
    // "signed out" and "could not ask" are different facts: a transient
    // network blip or a 5xx must not flip a signed-in store to anonymous
    // (a route guard would bounce the user to /login over nothing).
    const store = createAuthStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { user }),
        new Error('offline'),
        jsonResponse(502, { error: 'Bad gateway.', code: 'server_error' })
      )
    });
    await store.checkStatus();
    expect(store.user).not.toBeNull();

    await expect(store.checkStatus()).resolves.toEqual({
      success: false,
      code: 'network_error'
    });
    expect(store.user).not.toBeNull();
    expect(store.loading).toBe(false);

    await expect(store.checkStatus()).resolves.toEqual({
      success: false,
      error: 'Bad gateway.',
      code: 'server_error'
    });
    expect(store.user).not.toBeNull();
  });

  it('logout threads the wire contract of a server-side failure', async () => {
    const store = createAuthStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { user }),
        jsonResponse(403, { error: 'CSRF check failed.', code: 'csrf_failed' })
      )
    });
    await store.login('a@b.c', 'pw');

    const result = await store.logout();
    expect(result).toEqual({ success: false, error: 'CSRF check failed.', code: 'csrf_failed' });
    // local state still clears — the user asked to leave
    expect(store.user).toBeNull();
  });

  it('a 200 without a user is a malformed success, not a login', async () => {
    // captive portal / broken mock: reporting success while isAuthenticated
    // stays false would send the consumer into a navigate→bounce loop
    const store = createAuthStore({ fetcher: fetcherReturning(jsonResponse(200, {})) });
    const result = await store.login('a@b.c', 'pw');
    expect(result).toEqual({ success: false, code: 'server_error' });
    expect(store.user).toBeNull();
  });
});

function record(id: string, readAt: Date | null = null): NotificationRecord {
  return {
    id,
    userId: 'u1',
    typeKey: 'info',
    title: `n-${id}`,
    body: null,
    url: null,
    icon: null,
    readAt,
    createdAt: new Date('2026-07-01T00:00:00Z')
  };
}

describe('createNotificationStore', () => {
  it('load success replaces the list and clears lastError', async () => {
    const store = createNotificationStore({
      fetcher: fetcherReturning(jsonResponse(200, { notifications: [record('a'), record('b')] }))
    });
    await expect(store.load()).resolves.toBe(true);
    expect(store.notifications).toHaveLength(2);
    expect(store.unreadCount).toBe(2);
    expect(store.lastError).toBeNull();
  });

  it('a failed load keeps the existing list and records the wire error — no fake empty inbox', async () => {
    const store = createNotificationStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { notifications: [record('a')] }),
        jsonResponse(401, { error: 'Please sign in to continue.', code: 'not_authenticated' }),
        jsonResponse(200, { notifications: [record('b'), record('c')] })
      )
    });
    await store.load();
    expect(store.notifications).toHaveLength(1);

    await expect(store.load()).resolves.toBe(false);
    expect(store.notifications).toHaveLength(1);
    expect(store.lastError).toEqual({
      error: 'Please sign in to continue.',
      code: 'not_authenticated'
    });

    // a successful reload replaces the list and clears the recorded failure
    await expect(store.load()).resolves.toBe(true);
    expect(store.notifications.map((n) => n.id)).toEqual(['b', 'c']);
    expect(store.lastError).toBeNull();
  });

  it('threads limit/unreadOnly into the load query string', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, { notifications: [] }));
    const store = createNotificationStore({ fetcher });
    await store.load({ limit: 5, unreadOnly: true });
    expect(fetcher).toHaveBeenCalledWith('/api/notifications?limit=5&unreadOnly=true');
  });

  it('a network failure during load synthesizes network_error', async () => {
    const store = createNotificationStore({ fetcher: fetcherReturning(new Error('offline')) });
    await expect(store.load()).resolves.toBe(false);
    expect(store.lastError).toEqual({ code: 'network_error' });
    expect(store.loading).toBe(false);
  });

  it('markAsRead applies the change only after the server confirms', async () => {
    const store = createNotificationStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { notifications: [record('a')] }),
        jsonResponse(403, { error: 'Forbidden.', code: 'forbidden' }),
        jsonResponse(200, {})
      )
    });
    await store.load();

    await expect(store.markAsRead('a')).resolves.toBe(false);
    expect(store.notifications[0].readAt).toBeNull();
    expect(store.lastError).toEqual({ error: 'Forbidden.', code: 'forbidden' });

    await expect(store.markAsRead('a')).resolves.toBe(true);
    expect(store.notifications[0].readAt).toBeInstanceOf(Date);
    // a success clears the previous failure
    expect(store.lastError).toBeNull();
  });

  it('markAllAsRead marks everything read on success without stomping existing timestamps', async () => {
    const alreadyRead = new Date('2026-06-30T12:00:00Z');
    const store = createNotificationStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { notifications: [record('a'), record('b', alreadyRead)] }),
        jsonResponse(200, {})
      )
    });
    await store.load();
    await expect(store.markAllAsRead()).resolves.toBe(true);
    expect(store.unreadCount).toBe(0);
    // the `readAt ?? new Date()` is deliberate: an already-read row keeps its
    // original timestamp instead of being rewritten to "now". Over the wire
    // readAt arrives JSON-serialized (ISO string), so that is what must survive.
    expect(store.notifications.find((n) => n.id === 'b')?.readAt).toEqual(
      alreadyRead.toISOString()
    );
  });

  it('delete drops the row only once the server confirms', async () => {
    const store = createNotificationStore({
      fetcher: fetcherReturning(
        jsonResponse(200, { notifications: [record('a')] }),
        jsonResponse(500, {
          error: 'Something went wrong. Please try again.',
          code: 'server_error'
        }),
        jsonResponse(200, {})
      )
    });
    await store.load();

    await expect(store.delete('a')).resolves.toBe(false);
    expect(store.notifications).toHaveLength(1);
    expect(store.lastError?.code).toBe('server_error');

    await expect(store.delete('a')).resolves.toBe(true);
    expect(store.notifications).toHaveLength(0);
  });

  it('encodes the notification id into the route', async () => {
    const fetcher = fetcherReturning(jsonResponse(200, {}));
    const store = createNotificationStore({ fetcher });
    await store.markAsRead('a/b c');
    expect(fetcher).toHaveBeenCalledWith(
      '/api/notifications/a%2Fb%20c/read',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
