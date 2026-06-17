import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import type { NotificationPreferenceRepository } from '../../adapters/types.js';
import { readJsonBody } from '../../validation.js';

const MAX_TYPE_KEY_LENGTH = 256;

/** Coerce an optional preference flag: a non-boolean falls back to `true`. */
function flag(v: unknown): boolean {
  return typeof v === 'boolean' ? v : true;
}

export function createPreferencesHandler(repo: NotificationPreferenceRepository): {
  GET: RequestHandler;
  PUT: RequestHandler;
} {
  return {
    GET: async ({ locals }) => {
      const user = (locals as { user?: { id: string } }).user;
      if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

      const prefs = await repo.findByUser(user.id);
      return json({ preferences: prefs });
    },

    PUT: async ({ request, locals }) => {
      const user = (locals as { user?: { id: string } }).user;
      if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
      }

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

      // Coerce the flags to booleans — a client sending a non-boolean (or
      // omitting a flag) must not write arbitrary values into the repo.
      await repo.upsert(user.id, typeKey, {
        sse: flag(sse),
        push: flag(push),
        email: flag(email)
      });
      return json({ success: true });
    }
  };
}
