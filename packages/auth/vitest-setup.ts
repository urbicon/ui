import { beforeEach } from 'vitest';
import { __resetSeenSecretsForTests, resetRateLimiters } from './src/lib/server/secret-registry.js';

// The two process-wide registries keyed on the `jwt.secret` — the rate-limit
// counters and the repeat-bundle warning — and this suite builds its bundles
// from a handful of literal secrets (`createMockAuthDeps` alone hands out
// 'test-secret'). Left alone, every test in a file after the first would
// inherit the counters, and the limits, of the tests before it: a `max: 1`
// test meets the budget a sibling spent, a 429 is spent before the test that
// expects it, and the one-shot warning lands on whichever test makes the
// file's second bundle. Per test rather than per file so that no file has to
// remember it. Only `secret-registry.ts` is imported here, and that module
// imports nothing at runtime: whatever a setup file loads is pinned before any
// `vi.mock` in the file under test — see the note in vitest.config.ts.
beforeEach(() => {
  resetRateLimiters();
  __resetSeenSecretsForTests();
});
