import { beforeAll } from 'vitest';
import { scanSource } from './src/lib/audit/scan/scanner';

/**
 * Warms the audit scanner's lazily-loaded parsers once per test worker.
 *
 * `ts-walker.ts` does `await import('typescript')` and `svelte-ast.ts` does
 * `await import('svelte/compiler')` — deliberately, because both are dev-only
 * and must not be pulled into every consumer of this package. The cost is a
 * cold start on first use, and Vitest isolates modules per test file, so every
 * scanning suite pays it inside the 5s clock of whichever test happens to run
 * first.
 *
 * That is comfortable on a laptop and a timeout on slower or loaded hardware:
 * running the whole monorepo's suites in parallel on the 4-core deploy host
 * failed four tests across two files with `Test timed out in 5000ms`, while the
 * same package passed on its own. Warming here (with the generous timeout the
 * config sets) keeps the per-test budget measuring the scan, not the import.
 */
beforeAll(async () => {
  await scanSource('const warm = 1;', 'warmup.ts');
  await scanSource('<span>{t("warm.up")}</span>', 'Warmup.svelte');
});
