import type { RequestHandler } from '@sveltejs/kit';
import { json } from '@sveltejs/kit';
import { resetTestAuthWorld } from '$lib/server/test-auth.js';

/**
 * Seeds a deterministic fresh world for the E2E auth suite. Call once at
 * the start of every test via `page.request.post(...)` so parallelism
 * can't cross-contaminate state. Never wire this into production code.
 */
export const POST: RequestHandler = async () => {
  await resetTestAuthWorld();
  return json({ ok: true });
};
