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
      // Vitest's default, pinned explicitly: the suite relies on per-file module
      // isolation. registration-handlers.test.ts module-mocks `./webauthn.js`,
      // and passkey/handlers.test.ts must keep the real core — a shared registry
      // (`--no-isolate`) would let the mock bleed across files with failures
      // misattributed to innocent siblings. Keep this on.
      isolate: true
    }
  })
);
