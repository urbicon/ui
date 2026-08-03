import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Default environment is node — most tests here are variant/logic checks
      // with no DOM. Component tests opt into jsdom per-file with a
      // `// @vitest-environment jsdom` docblock (the `*.svelte.test.ts` files),
      // so the node suite stays fast and untouched. Same split as blocks.
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,svelte}', 'src/**/*.svelte.{test,spec}.ts'],
      globals: true,
      // jsdom gaps the mounted components fall into. Guarded on `window`, so
      // the node files load it and skip everything in it.
      setupFiles: ['./vitest-setup.ts']
    },
    // Component tests mount real Svelte components, which need the browser build
    // of svelte. Without this, `mount()` runs the SSR build and every test dies
    // on `lifecycle_function_unavailable`. Scoped to test runs — this config
    // only loads under vitest, never during build or dev.
    resolve: {
      conditions: ['browser']
    }
  })
);
