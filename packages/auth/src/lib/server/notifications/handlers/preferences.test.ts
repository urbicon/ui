import type { RequestEvent } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type {
  NotificationPreference,
  NotificationPreferenceRepository
} from '../../adapters/types.js';
import { createPreferencesHandler } from './preferences.js';

/**
 * The notification-preferences endpoint reads/writes per-user channel settings.
 * Both verbs scope to `locals.user.id` (set by the auth handle), never a
 * body-supplied id — the regression guard against an authenticated user editing
 * someone else's preferences (Cluster J / the IDOR note in the I.3 doc pass).
 */

function mockRepo(
  overrides: Partial<NotificationPreferenceRepository> = {}
): NotificationPreferenceRepository {
  return { findByUser: vi.fn().mockResolvedValue([]), upsert: vi.fn(), ...overrides };
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
    const res = await createPreferencesHandler(repo).GET(event(undefined));
    expect(res.status).toBe(401);
    expect(repo.findByUser).not.toHaveBeenCalled();
  });

  it('returns the preferences scoped to the session user', async () => {
    const prefs: NotificationPreference[] = [
      { typeKey: 'security', sse: true, push: false, email: true }
    ];
    const repo = mockRepo({ findByUser: vi.fn().mockResolvedValue(prefs) });
    const res = await createPreferencesHandler(repo).GET(event(undefined, { id: 'owner-1' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ preferences: prefs });
    expect(repo.findByUser).toHaveBeenCalledWith('owner-1');
  });
});

describe('createPreferencesHandler — PUT', () => {
  it('returns 401 when unauthenticated', async () => {
    const repo = mockRepo();
    const res = await createPreferencesHandler(repo).PUT(event({ typeKey: 'security' }));
    expect(res.status).toBe(401);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when typeKey is missing', async () => {
    const repo = mockRepo();
    const res = await createPreferencesHandler(repo).PUT(event({ sse: true }, { id: 'owner-1' }));
    expect(res.status).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('returns 400 when typeKey is not a string or is over-long', async () => {
    const repo = mockRepo();
    const handler = createPreferencesHandler(repo);
    expect((await handler.PUT(event({ typeKey: 123 }, { id: 'u1' }))).status).toBe(400);
    expect((await handler.PUT(event({ typeKey: { x: 1 } }, { id: 'u1' }))).status).toBe(400);
    expect((await handler.PUT(event({ typeKey: 'x'.repeat(257) }, { id: 'u1' }))).status).toBe(400);
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('coerces non-boolean flags to true (no arbitrary values reach the repo)', async () => {
    const repo = mockRepo();
    const res = await createPreferencesHandler(repo).PUT(
      // A client sends junk for the flags; they must be coerced, not stored raw.
      event({ typeKey: 'security', sse: 'yes', push: 0, email: undefined }, { id: 'owner-1' })
    );
    expect(res.status).toBe(200);
    expect(repo.upsert).toHaveBeenCalledWith('owner-1', 'security', {
      sse: true,
      push: true,
      email: true
    });
  });

  it('upserts the preference scoped to the session user, ignoring any body-supplied id', async () => {
    const repo = mockRepo();
    const res = await createPreferencesHandler(repo).PUT(
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
