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
      setupFiles: ['./vitest-setup.ts'],
      // The audit-scanner suites load real compilers (`typescript`,
      // `svelte/compiler`) through the lazy imports the scanner ships with. The
      // setup file warms them per worker, but the parses themselves are still
      // heavy enough that Vitest's 5s default is a coin flip under load — it
      // failed on the 4-core deploy host while passing locally. Budget for the
      // work these tests actually do; a real hang still fails, just later.
      testTimeout: 30_000
    }
  })
);
