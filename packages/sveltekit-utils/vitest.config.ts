import path from 'node:path';
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
      // `$app/*` are virtual modules the Kit runtime provides — in vitest
      // they resolve to the reactive test harness instead (SvelteKit timing:
      // reads reactive, `goto` applies asynchronously). Only the
      // view-binding tests import them.
      alias: {
        '$app/state': path.resolve(__dirname, 'src/test-support/app-state.ts'),
        '$app/navigation': path.resolve(__dirname, 'src/test-support/app-navigation.ts'),
        '$app/environment': path.resolve(__dirname, 'src/test-support/app-environment.ts')
      }
    },
    // Without the browser condition Svelte resolves to its *server* build,
    // where `$effect` is a no-op — the view-binding suite needs the client
    // runtime. Same reasoning as packages/blocks and packages/table; scoped
    // to test runs only.
    resolve: {
      conditions: ['browser']
    }
  })
);
