import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Standalone from `vite.config.ts` on purpose: these are plain node assertions over
 * the route sources as TEXT (no SvelteKit plugin, no browser env, no compile step),
 * so the docs suite stays instant and cannot break on kit/plugin churn.
 *
 * The one thing it does borrow from SvelteKit is the `$lib` alias, because app
 * modules under test import each other through it (the app's own convention) —
 * `$lib/landing/occupancy` reads the hotel register from `$lib/hotel-tools`.
 * An alias is not a plugin: no compile step, nothing to churn.
 */
export default defineConfig({
  resolve: {
    alias: { $lib: fileURLToPath(new URL('./src/lib', import.meta.url)) }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts']
  }
});
