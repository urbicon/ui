import { defineConfig } from 'vitest/config';

/**
 * Standalone from `vite.config.ts` on purpose: these are plain node assertions over
 * the route sources as TEXT (no SvelteKit plugin, no browser env, no compile step),
 * so the docs suite stays instant and cannot break on kit/plugin churn.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
  }
});
