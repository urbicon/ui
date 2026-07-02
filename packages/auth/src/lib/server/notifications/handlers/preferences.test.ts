import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type {
  NotificationPreference,
  NotificationPreferenceRepository
} from '../../adapters/types.js';
import { createNotificationRegistry } from '../registry.js';
import type { PreferencesHandlerOptions } from './preferences.js';
import { createPreferencesHandler } from './preferences.js';

/**
 * The notification-preferences endpoint reads/writes per-user channel settings.
 * Both verbs scope to `locals.user.id` (set by the auth handle), never a
 * body-supplied id — the regression guard against an authenticated user editing
 * someone else's preferences (Cluster J / the IDOR note in the I.3 doc pass).
 * PUT additionally validates the typeKey against the registry (unbounded-row
 * growth guard, R13) and is rate-limited per user.
 */

function mockRepo(
  overrides: Partial<NotificationPreferenceRepository> = {}
): NotificationPreferenceRepository {
  return { findByUser: vi.fn().mockResolvedValue([]), upsert: vi.fn(), ...overrides };
}

/** Registry with the 'security' type all tests write against. */
function testRegistry() {
  const registry = createNotificationRegistry();
  registry.register({ key: 'security', title: 'Security', recipients: [] });
  return registry;
}

function handler(repo: NotificationPreferenceRepository, options?: PreferencesHandlerOptions) {
  return createPreferencesHandler(repo, testRegistry(), options);
}

function event(body: unknown, user?: { id: string }): RequestEvent {
  return {
    request: new Request('http://localhost/api/notifications/preferences', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' }
    }),
    locals: user ? { user } : {}
  } as unknown as RequestEvent;
}

describe('createPreferencesHandler — GET', () => {
  it('returns 401 when unauthenticated', async () => {
    const repo = mockRepo();
    const res = await handler(repo).GET(event(undefined));
    expect(res.status).toBe(401);
    expect(repo.findByUser).not.toHaveBeenCalled();
  });

  it('returns the preferences scoped to the session user', async () => {
    const prefs: NotificationPreference[] = [
      { typeKey: 'security', sse: true, push: false, email: true }
    ];
    const repo = mockRepo({ findByUser: vi.fn().mockResolvedValue(prefs) });
    const res = await handler(repo).GET(event(undefined, { id: 'owner-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ preferences: prefs });
    expect(repo.findByUser).toHaveBeenCalledWith('owner-1');
  });
});

describe('createPreferencesHandler — PUT', () => {
  it('returns 401 when unauthenticated', async () => {
    const repo = mockRepo();
    const res = await handler(repo).PUT(event({ typeKey: 'security' }));
    expect(res.status).toBe(401);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when typeKey is missing', async () => {
    const repo = mockRepo();
    const res = await handler(repo).PUT(event({ sse: true }, { id: 'owner-1' }));
    expect(res.status).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when typeKey is not a string or is over-long', async () => {
    const repo = mockRepo();
    const h = handler(repo);
    expect((await h.PUT(event({ typeKey: 123 }, { id: 'u1' }))).status).toBe(400);
    expect((await h.PUT(event({ typeKey: { x: 1 } }, { id: 'u1' }))).status).toBe(400);
    expect((await h.PUT(event({ typeKey: 'x'.repeat(257) }, { id: 'u1' }))).status).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('rejects a typeKey that is not a registered notification type (400)', async () => {
    // Without the registry gate, ANY ≤256-char string persists a row —
    // unbounded per-user table growth (R13).
    const repo = mockRepo();
    const res = await handler(repo).PUT(
      event({ typeKey: 'never-registered', sse: false }, { id: 'owner-1' })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/unknown notification type/i);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('rate-limits PUT per user (429 with Retry-After, repo untouched past the limit)', async () => {
    const repo = mockRepo();
    const h = handler(repo, { rateLimit: { windowMs: 60_000, max: 2 } });
    const put = () => h.PUT(event({ typeKey: 'security', sse: true }, { id: 'owner-1' }));
    expect((await put()).status).toBe(200);
    expect((await put()).status).toBe(200);
    const limited = await put();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBeTruthy();
    expect(repo.upsert).toHaveBeenCalledTimes(2);

    // GET stays deliberately unlimited (reads are cheap and registry-bounded)
    // — an exhausted PUT budget must not break NotificationCenter polling.
    const read = await h.GET(event(undefined, { id: 'owner-1' }));
    expect(read.status).toBe(200);
  });

  it('rateLimit: null disables limiting entirely (opt-out must not regress to the default)', async () => {
    const repo = mockRepo();
    const h = handler(repo, { rateLimit: null });
    // One past the built-in default of 30 — all must pass.
    for (let i = 0; i < 31; i++) {
      expect(
        (await h.PUT(event({ typeKey: 'security', sse: true }, { id: 'owner-1' }))).status
      ).toBe(200);
    }
    expect(repo.upsert).toHaveBeenCalledTimes(31);
  });

  it('rejects non-boolean flags with 400 (write-strict: junk must not flip a channel ON)', async () => {
    // `push: "false"` clearly intends DISABLE — the old coerce-to-true
    // behaviour silently re-enabled the channel and answered success.
    const repo = mockRepo();
    const h = handler(repo);
    for (const body of [
      { typeKey: 'security', sse: 'yes' },
      { typeKey: 'security', push: 'false' },
      { typeKey: 'security', push: 0 },
      { typeKey: 'security', email: null }
    ]) {
      const res = await h.PUT(event(body, { id: 'owner-1' }));
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('omitted flags stay omitted — the adapter merge keeps stored values (no reset to true)', async () => {
    const repo = mockRepo();
    const res = await handler(repo).PUT(
      event({ typeKey: 'security', sse: false }, { id: 'owner-1' })
    );
    expect(res.status).toBe(200);
    // Exactly the submitted flag reaches the repo; push/email absent, so a
    // previously stored push:false cannot be silently reset.
    expect(repo.upsert).toHaveBeenCalledWith('owner-1', 'security', { sse: false });
  });

  it('upserts the preference scoped to the session user, ignoring any body-supplied id', async () => {
    const repo = mockRepo();
    const res = await handler(repo).PUT(
      // A hostile body claims a different owner; the handler must use locals.
      event(
        { userId: 'victim-2', typeKey: 'security', sse: false, push: true, email: false },
        {
          id: 'owner-1'
        }
      )
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(repo.upsert).toHaveBeenCalledWith('owner-1', 'security', {
      sse: false,
      push: true,
      email: false
    });
    expect(repo.upsert).not.toHaveBeenCalledWith('victim-2', expect.anything(), expect.anything());
  });
});
