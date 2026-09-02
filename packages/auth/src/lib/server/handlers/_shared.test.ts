import type { Cookies } from '@sveltejs/kit';
import { describe, expect, it, vi } from 'vitest';
import type { AuthSession } from '../../types.js';
import type { AuthDeps } from '../deps.js';
import { hashPassword } from '../password.js';
import { setSessionCookie } from '../session.js';
import { createMockAuthDeps, createMockUser, mockPostEvent } from '../test-utils.js';
import {
  parseBody,
  passwordRefusal,
  privateEndpoints,
  requireSessionUser,
  verifyCurrentPassword
} from './_shared.js';

/**
 * `requireSessionUser` and `verifyCurrentPassword` are the two shared building
 * blocks every authenticated/security-critical handler (account management,
 * sessions, 2FA) is built on. They concentrate the session-resolution +
 * token-version invalidation that used to live inline in `me`, and the
 * password re-auth that used to live inline in `login`. Test them directly so a
 * regression surfaces here once rather than across half a dozen handler suites.
 */

/** Mint a valid access cookie into the event's jar, keyed to `deps.config.jwt`. */
async function signIn<R extends string>(
  ev: ReturnType<typeof mockPostEvent>,
  deps: AuthDeps<R>,
  session: AuthSession<R>
): Promise<void> {
  await setSessionCookie(ev.cookies as unknown as Cookies, session, deps.config.jwt);
}

const VALID_SESSION: AuthSession<string> = {
  userId: 'user-1',
  email: 'test@test.com',
  role: 'admin',
  tokenVersion: 0
};

describe('requireSessionUser', () => {
  it('returns null and never touches the user table when no session cookie is present', async () => {
    const deps = createMockAuthDeps();
    const ev = mockPostEvent({});

    expect(await requireSessionUser(deps, ev.cookies as unknown as Cookies)).toBeNull();
    expect(deps.repos.user.findById).not.toHaveBeenCalled();
  });

  it('returns null when the cookie is valid but the user no longer exists', async () => {
    const deps = createMockAuthDeps({ user: { findById: vi.fn().mockResolvedValue(null) } });
    const ev = mockPostEvent({});
    await signIn(ev, deps, VALID_SESSION);

    expect(await requireSessionUser(deps, ev.cookies as unknown as Cookies)).toBeNull();
    expect(deps.repos.user.findById).toHaveBeenCalledWith('user-1');
  });

  it('returns null when the cookie tokenVersion is stale (behind the row)', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 })) }
    });
    const ev = mockPostEvent({});
    await signIn(ev, deps, { ...VALID_SESSION, tokenVersion: 0 });

    expect(await requireSessionUser(deps, ev.cookies as unknown as Cookies)).toBeNull();
  });

  it('returns null when the cookie tokenVersion is ahead of the row (exact-match, not directional)', async () => {
    const deps = createMockAuthDeps({
      user: { findById: vi.fn().mockResolvedValue(createMockUser({ tokenVersion: 1 })) }
    });
    const ev = mockPostEvent({});
    await signIn(ev, deps, { ...VALID_SESSION, tokenVersion: 2 });

    expect(await requireSessionUser(deps, ev.cookies as unknown as Cookies)).toBeNull();
  });

  it('returns the full user row (incl. password hash) on a valid, current session', async () => {
    const user = createMockUser({ passwordHash: 'stored-hash', tokenVersion: 3 });
    const deps = createMockAuthDeps({ user: { findById: vi.fn().mockResolvedValue(user) } });
    const ev = mockPostEvent({});
    await signIn(ev, deps, { ...VALID_SESSION, tokenVersion: 3 });

    const resolved = await requireSessionUser(deps, ev.cookies as unknown as Cookies);
    expect(resolved?.id).toBe('user-1');
    // The full row — not the sanitized shape — so callers can re-auth/mutate.
    expect(resolved?.passwordHash).toBe('stored-hash');
  });
});

describe('verifyCurrentPassword', () => {
  it('returns true for the correct current password', async () => {
    const deps = createMockAuthDeps();
    const user = createMockUser({ passwordHash: await hashPassword('correct') });

    expect(await verifyCurrentPassword(user, 'correct', deps)).toBe(true);
  });

  it('returns false for a wrong password', async () => {
    const deps = createMockAuthDeps();
    const user = createMockUser({ passwordHash: await hashPassword('correct') });

    expect(await verifyCurrentPassword(user, 'wrong', deps)).toBe(false);
  });

  it('returns false (fail-closed) for an unparseable stored hash', async () => {
    const deps = createMockAuthDeps();
    const user = createMockUser({ passwordHash: 'not-a-real-hash' });

    expect(await verifyCurrentPassword(user, 'anything', deps)).toBe(false);
  });

  it('verifies against a hash created with a custom work factor', async () => {
    // The re-auth path must read the iteration count from the stored hash, so a
    // hash minted at a non-default work factor still verifies.
    const deps = createMockAuthDeps({ config: { password: { pbkdf2Iterations: 120_000 } } });
    const user = createMockUser({
      passwordHash: await hashPassword('correct', { pbkdf2Iterations: 120_000 })
    });

    expect(await verifyCurrentPassword(user, 'correct', deps)).toBe(true);
  });

  it('performs no side effects — never rehashes or writes', async () => {
    const updatePassword = vi.fn();
    const deps = createMockAuthDeps({ user: { updatePassword } });
    // A legacy-low-iteration hash would be a rehash candidate on login; the
    // re-auth helper must NOT write here (the action's own handler decides).
    const user = createMockUser({
      passwordHash: await hashPassword('correct', { pbkdf2Iterations: 1000 })
    });

    expect(await verifyCurrentPassword(user, 'correct', deps)).toBe(true);
    expect(updatePassword).not.toHaveBeenCalled();
  });
});

describe('parseBody', () => {
  const validator = (raw: unknown) => {
    const email = (raw as { email?: unknown })?.email;
    if (typeof email !== 'string' || !email.includes('@')) {
      return {
        success: false as const,
        errors: [
          { field: 'email', message: 'Email is invalid' },
          { field: 'email', message: 'Second issue' }
        ]
      };
    }
    return { success: true as const, data: { email } };
  };

  const jsonRequest = (body: string) =>
    new Request('http://localhost/x', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'application/json' }
    });

  it('returns the validated data on success', async () => {
    const result = await parseBody(jsonRequest('{"email":"a@b.c"}'), validator);
    expect(result).toEqual({ data: { email: 'a@b.c' } });
  });

  it('produces the full canonical validation 400 — code, first-error prose, errors array, directive', async () => {
    // Test-review mutation finding: dropping the errors array survived the
    // whole suite — this is the single choke point for 14 handler preambles,
    // so the envelope is pinned here once. `Cache-Control` is asserted without
    // being passed: it belongs to the refusal `authError` builds, so no caller
    // forwards it any more.
    const result = await parseBody(jsonRequest('{"email":42}'), validator);
    expect(result).toBeInstanceOf(Response);
    const res = result as Response;
    expect(res.status).toBe(400);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    const body = await res.json();
    expect(body.code).toBe('validation_error');
    expect(body.error).toBe('Email is invalid');
    expect(body.errors).toEqual([
      { field: 'email', message: 'Email is invalid' },
      { field: 'email', message: 'Second issue' }
    ]);
  });

  it('maps a malformed JSON body to the validation 400, never a 500', async () => {
    const result = await parseBody(jsonRequest('not json'), validator);
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });
});

describe('passwordRefusal', () => {
  it('passes a password that clears the policy', () => {
    expect(passwordRefusal('abcdefghij', { minLength: 8 })).toBeNull();
  });

  it('carries the failing rules and the policy, not just English prose', async () => {
    // The prose is the reason a German user used to read
    // "Password must be at least 12 characters": `errorMessageFromCode`
    // deliberately prefers the server text for `validation_error`. The machine
    // fields are what let a localized client render its own labels instead.
    const res = passwordRefusal('short', { minLength: 12, requireDigit: true });
    expect(res).not.toBeNull();
    expect((res as Response).status).toBe(400);
    const body = await (res as Response).json();
    expect(body.code).toBe('validation_error');
    expect(body.rules).toEqual(['minLength', 'digit']);
    expect(body.passwordPolicy).toEqual({
      minLength: 12,
      requireUppercase: false,
      requireLowercase: false,
      requireDigit: true,
      requireSpecial: false
    });
    // Unchanged for consumers without i18n.
    expect(body.error).toBe('Password must be at least 12 characters');
    expect(body.errors).toHaveLength(2);
  });

  it('never ships the hashing work factor along with the policy', async () => {
    const res = passwordRefusal('x', { minLength: 12, pbkdf2Iterations: 654_321 });
    const raw = await (res as Response).text();
    expect(raw).not.toContain('pbkdf2');
    expect(raw).not.toContain('654321');
  });
});

/**
 * `privateEndpoints` promises one thing — a `Cache-Control` on the responses of
 * the endpoints it finds — so everything else in the bundle has to come back
 * exactly as it went in.
 *
 * It used to rebuild the bundle into a fresh object literal and recurse into
 * every value that was `typeof 'object'`, which is a deep rewrite of the
 * caller's object, not a header: an `Array` came back as `{"0":1}`, a `Date`
 * and a `Map` came back empty, a class instance lost its prototype, getters
 * were materialised into values, and a circular reference recursed until the
 * stack ran out. No bundle the package ships hits any of that today; the next
 * factory returning `{ GET, limiter }` would have hit the first one.
 */
describe('privateEndpoints', () => {
  const bare = () => new Response('x');

  it('sets no-store on an endpoint response that names no directive', async () => {
    const bundle = privateEndpoints({ GET: bare });
    expect((await bundle.GET()).headers.get('cache-control')).toBe('no-store');
  });

  it('leaves a directive the response already names', async () => {
    const bundle = privateEndpoints({
      GET: () => new Response('x', { headers: { 'Cache-Control': 'public, max-age=300' } })
    });
    expect((await bundle.GET()).headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('reaches an endpoint nested in a group', async () => {
    const bundle = privateEndpoints({ list: { GET: bare } });
    expect((await bundle.list.GET()).headers.get('cache-control')).toBe('no-store');
  });

  it('returns the same object rather than a copy', () => {
    const bundle = { GET: bare };
    expect(privateEndpoints(bundle)).toBe(bundle);
  });

  it('hands every non-endpoint value back untouched', () => {
    class Limiter {
      readonly kind = 'limiter';
      check() {
        return true;
      }
    }
    const map = new Map([['a', 1]]);
    const date = new Date('2026-01-01T00:00:00.000Z');
    const limiter = new Limiter();
    const bundle = privateEndpoints({
      GET: bare,
      methods: ['GET', 'POST'],
      since: date,
      seen: map,
      limiter,
      prerender: true
    });

    expect(Array.isArray(bundle.methods)).toBe(true);
    expect(bundle.methods).toEqual(['GET', 'POST']);
    expect(bundle.since).toBe(date);
    expect(bundle.since.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(bundle.seen).toBe(map);
    expect(bundle.seen.get('a')).toBe(1);
    expect(bundle.limiter).toBe(limiter);
    expect(bundle.limiter.check()).toBe(true);
    expect(bundle.prerender).toBe(true);
  });

  it('does not recurse forever on a circular reference', () => {
    const bundle: Record<string, unknown> = { GET: bare };
    bundle.self = bundle;
    expect(() => privateEndpoints(bundle)).not.toThrow();
  });

  it('wraps `fallback`, which answers every method not exported by name', async () => {
    const bundle = privateEndpoints({ fallback: bare });
    expect((await bundle.fallback()).headers.get('cache-control')).toBe('no-store');
  });
});
