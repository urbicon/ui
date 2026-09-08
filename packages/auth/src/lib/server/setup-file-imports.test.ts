import { expect, it, vi } from 'vitest';
import { createRateLimiter, enforceRateLimit } from './rate-limit.js';

vi.mock('./handlers/errors.js', () => ({
  authError: () => new Response('mocked', { status: 599 })
}));

// Positive control for the rule behind the package's vitest setup file
// (vitest.config.ts → setupFiles): it may import only `secret-registry.ts`,
// which imports nothing at runtime. A module a setup file loads is pinned in
// the registry before any `vi.mock` in the file under test runs, so a setup
// file importing `rate-limit.ts` pins `handlers/errors.ts` with it and the
// mock above is never seen — measured: 429 from the real `authError` with such
// an import, 599 without. The day the setup file gains an import, this is red.
it('a module the setup file must not import is still mockable from a test file', async () => {
  const limiter = createRateLimiter({ windowMs: 60_000, max: 0 });
  const refused = await enforceRateLimit(limiter, 'ip');
  expect(refused?.status).toBe(599);
});
