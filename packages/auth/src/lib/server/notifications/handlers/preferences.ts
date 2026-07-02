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

/**
 * Parse an optional preference flag, write-strict: absent means "leave the
 * stored value untouched" (the adapters' upsert merges partial data — pinned
 * by the conformance suite), a boolean passes through, and anything else is
 * `'invalid'` → 400. Coercing junk to `true` (the old behaviour) would turn
 * a client's `push: "false"` — clearly intended as DISABLE — into silently
 * re-enabling the channel, and a partial PUT into resetting the other flags.
 */
function parseFlag(v: unknown): boolean | undefined | 'invalid' {
  if (v === undefined) return undefined;
  return typeof v === 'boolean' ? v : 'invalid';
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

      const sseFlag = parseFlag(sse);
      const pushFlag = parseFlag(push);
      const emailFlag = parseFlag(email);
      if (sseFlag === 'invalid' || pushFlag === 'invalid' || emailFlag === 'invalid') {
        return json({ error: 'Preference flags must be booleans' }, { status: 400 });
      }

      // Only the flags actually present in the body reach the repo — the
      // adapter upsert merges, so omitted flags keep their stored value
      // instead of being reset to true.
      await repo.upsert(userId, typeKey, {
        ...(sseFlag !== undefined && { sse: sseFlag }),
        ...(pushFlag !== undefined && { push: pushFlag }),
        ...(emailFlag !== undefined && { email: emailFlag })
      });
      return json({ success: true });
    }
  };
}
