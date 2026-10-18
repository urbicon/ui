import { defineConfig } from 'vitest/config';

/**
 * Standalone from `vite.config.ts` on purpose: these are plain node assertions over
 * the route sources as TEXT (no SvelteKit plugin, no browser env, no compile step),
 * so the docs suite stays instant and cannot break on kit/plugin churn. App modules
 * under test still import each other through `#lib` — a package.json subpath
 * import, which Vite resolves on its own.
 *
 * The transform still reads `tsconfig.json`, which extends `$app/tsconfig` — a
 * file `svelte-kit sync` generates into `node_modules/$app/`. A clean checkout
 * has none, and every test file then dies with `[TSCONFIG_ERROR] Tsconfig not
 * found` before a single assertion; hence the sync inside the `test` script.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
  }
});
