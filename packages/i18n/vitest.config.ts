import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,svelte}'],
      globals: true,
      // The audit-scanner suites load real compilers — `typescript` in
      // `ts-walker.ts`, `svelte/compiler` in `svelte-ast.ts` — through the lazy
      // imports the scanner ships with (both are dev-only and must stay out of
      // consumer bundles). Vitest isolates modules per file, so each scanning
      // suite pays that cold start inside its first test's clock. Comfortable on
      // a laptop, a timeout on the 4-core deploy host.
      //
      // A `setupFiles` warm-up was tried first and made it worse: it ran in a
      // `beforeAll` for all twelve files in the package — including the ones that
      // never touch the scanner — and `testTimeout` does not cover hooks, so it
      // simply moved the failure to the 10s hook default. One budget, applied
      // where the work happens, is both simpler and faster.
      testTimeout: 30_000
    },
    // `reactivity.svelte.test.ts` drives real `$effect`s. Two knobs have to be
    // right for that and both fail silently: the file needs a
    // `// @vitest-environment jsdom` docblock (only the web transform mode
    // consults `resolve.conditions`), and the condition below has to exist at
    // all — without it Svelte resolves to its *server* build, where `$effect`
    // and `$effect.root` are no-ops that swallow the callback whole. Missing
    // either one, the suite passed while asserting nothing. Same reasoning as
    // packages/blocks and packages/table; scoped to test runs only.
    resolve: {
      conditions: ['browser']
    }
  })
);
