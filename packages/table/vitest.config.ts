import { mergeConfig } from 'vite';
import { defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'node',
      include: ['src/**/*.{test,spec}.{ts,svelte}'],
      globals: true
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
