import { beforeEach } from 'vitest';
import { __resetLimiterCacheForTests } from './src/lib/server/rate-limit.js';

// The rate-limit registry is process-wide and keyed on the `jwt.secret`
// fingerprint (`sharedLimiter`), and this suite builds its bundles from a
// handful of literal secrets — `createMockAuthDeps` alone hands out
// 'test-secret'. Left alone, every test in a file after the first would inherit
// the counters, and the limits, of the tests before it: a `max: 1` test meets
// the `max: 10` limiter a sibling built, and a 429 can be spent by the test
// before. Per test rather than per file so that no file has to remember it.
beforeEach(() => __resetLimiterCacheForTests());
