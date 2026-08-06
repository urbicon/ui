import path from 'node:path';
import { mergeConfig } from 'vite';
import { configDefaults, defineConfig } from 'vitest/config';
import viteConfig from './vite.config';

// `$app/*` are virtual modules the Kit runtime provides — in vitest they
// resolve to the reactive test harness instead (SvelteKit timing: reads
// reactive, `goto` applies asynchronously). Only the view-binding tests
// import them.
const appAliases = (environment: 'client' | 'server') => ({
  '$app/state': path.resolve(__dirname, 'src/test-support/app-state.ts'),
  '$app/navigation': path.resolve(__dirname, 'src/test-support/app-navigation.ts'),
  '$app/environment': path.resolve(
    __dirname,
    environment === 'client'
      ? 'src/test-support/app-environment.ts'
      : 'src/test-support/app-environment.server.ts'
  )
});

export default defineConfig({
  test: {
    projects: [
      // The client project: the bulk of the suite. Without the browser
      // condition Svelte resolves to its *server* build, where `$effect` is a
      // no-op — the view-binding tests need the client runtime. Same
      // reasoning as packages/blocks and packages/table; scoped to test runs.
      mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'client',
            environment: 'node',
            include: ['src/**/*.{test,spec}.{ts,svelte}'],
            exclude: [...configDefaults.exclude, 'src/**/*.ssr.test.ts'],
            globals: true,
            alias: appAliases('client')
          },
          resolve: {
            conditions: ['browser']
          }
        })
      ),
      // The SSR project: deliberately NO browser condition, so Svelte
      // resolves to its server build — `$effect` is a no-op and effect
      // teardowns never run, exactly the SSR situation the B1 leak lived in.
      // `$app/environment` resolves to the server half (`browser: false`).
      mergeConfig(
        viteConfig,
        defineConfig({
          test: {
            name: 'ssr',
            environment: 'node',
            include: ['src/**/*.ssr.test.ts'],
            globals: true,
            alias: appAliases('server')
          }
        })
      )
    ]
  }
});
