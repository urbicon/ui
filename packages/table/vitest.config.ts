import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Default stays node — the bulk of this suite is store/util/variant logic with no DOM,
      // and the SSR tests deliberately want the *server* render. Tests that mount a component
      // opt into jsdom per file with a `// @vitest-environment jsdom` docblock, same contract
      // as packages/blocks.
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,svelte}'],
      globals: true,
      // jsdom polyfills for the layout/overlay APIs a mounted table calls; guarded on
      // `window`, so node-environment tests load it and skip it.
      setupFiles: ['./vitest-setup.ts']
    },
    // Without the browser condition Svelte resolves to its *server* build, where
    // `$effect` is a no-op — so the debounced write path of `createPersistentState`
    // never ran in this suite and every persistence test had to force-save.
    // Same reasoning as packages/blocks; scoped to test runs only.
    resolve: {
      conditions: ['browser']
    }
  })
);
