import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { RateLimitConfig } from '../../../types.js';
import type { NotificationPreferenceRepository } from '../../adapters/types.js';
import { enforceRateLimit, makeRateLimiter } from '../../rate-limit.js';
import { readJsonBody } from '../../validation.js';
import type { NotificationRegistry } from '../registry.js';
import { localsUserId } from './locals-user.js';

const MAX_TYPE_KEY_LENGTH = 256;

/** Default PUT limit — generous for real toggling, a wall for scripted abuse. */
const DEFAULT_RATE_LIMIT: RateLimitConfig = { windowMs: 60_000, max: 30 };

/** Coerce an optional preference flag: a non-boolean falls back to `true`. */
function flag(v: unknown): boolean {
  return typeof v === 'boolean' ? v : true;
}

export interface PreferencesHandlerOptions {
  /**
   * Rate limit for the mutating `PUT`, keyed by the authenticated user id
   * (the endpoint requires a session, and a per-user key can't be dodged by
   * IP rotation). Default 30/min; pass `null` to disable.
   */
  rateLimit?: RateLimitConfig | null;
}

/**
 * Preferences CRUD for the authenticated user. The `registry` is required:
 * `PUT` rejects a `typeKey` that isn't a registered notification type (400).
 * Without that gate the upsert would persist a row for ANY ≤256-char string,
 * letting an authenticated user grow the preference table without bound —
 * validated, the per-user row count is capped by the number of registered
 * types (preferences for types nobody can `send()` are meaningless anyway).
 */
export function createPreferencesHandler(
  repo: NotificationPreferenceRepository,
  registry: NotificationRegistry,
  options?: PreferencesHandlerOptions
): {
  GET: RequestHandler;
  PUT: RequestHandler;
} {
  const rateLimiter = makeRateLimiter(
    options?.rateLimit === null ? undefined : (options?.rateLimit ?? DEFAULT_RATE_LIMIT)
  );

  return {
    GET: async ({ locals }) => {
      const userId = localsUserId(locals);
      if (!userId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const prefs = await repo.findByUser(userId);
      return json({ preferences: prefs });
    },

    PUT: async ({ request, locals }) => {
      const userId = localsUserId(locals);
      if (!userId) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const limited = await enforceRateLimit(rateLimiter, userId);
      if (limited) return limited;

      const { typeKey, sse, push, email } = (await readJsonBody(request)) as {
        typeKey?: unknown;
        sse?: unknown;
        push?: unknown;
        email?: unknown;
      };
      if (typeof typeKey !== 'string' || typeKey.length === 0) {
        return json({ error: 'typeKey is required' }, { status: 400 });
      }
      if (typeKey.length > MAX_TYPE_KEY_LENGTH) {
        return json(
          { error: `typeKey must be at most ${MAX_TYPE_KEY_LENGTH} characters` },
          { status: 400 }
        );
      }
      // Only registered types may hold a preference row — see the factory
      // JSDoc (unbounded-row-growth guard + semantic correctness).
      if (!registry.get(typeKey)) {
        return json({ error: 'Unknown notification type' }, { status: 400 });
      }

      // Coerce the flags to booleans — a client sending a non-boolean (or
      // omitting a flag) must not write arbitrary values into the repo.
      await repo.upsert(userId, typeKey, {
        sse: flag(sse),
        push: flag(push),
        email: flag(email)
      });
      return json({ success: true });
    }
  };
}
