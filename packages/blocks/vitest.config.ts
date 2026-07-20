import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Default environment is node — the vast majority of tests are variant/logic checks with no
      // DOM. Component tests opt into jsdom per-file with a `// @vitest-environment jsdom` docblock
      // (see the `*.svelte.test.ts` files), so the node suite stays fast and untouched.
      environment: 'node',
      include: [
        'src/**/*.{test,spec}.{ts,svelte}',
        'src/**/*.svelte.{test,spec}.ts',
        // scripts/ tooling with extractable pure logic (theme-tokens.ts for
        // the variants-lint theme-existence guard) tests next to the source.
        'scripts/*.{test,spec}.ts'
      ],
      globals: true,
      // Registers @testing-library/jest-dom matchers; see vitest-setup.ts for why it is safe to
      // load globally across both environments.
      setupFiles: ['./vitest-setup.ts']
    },
    // Component tests mount real Svelte components, which need the browser build of svelte + its
    // deps. Scoped to test runs (this config only loads under vitest, never during build/dev), and
    // blocks is frontend-only so there is no backend build to keep on the node condition.
    resolve: {
      conditions: ['browser']
    }
  })
);
