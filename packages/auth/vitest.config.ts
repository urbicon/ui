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
      isolate: true,
      // jsdom gaps the mounted auth components fall into. Guarded on `window`,
      // so the node-environment files (the bulk of this suite) load it and skip
      // everything in it.
      setupFiles: ['./vitest-setup.ts']
    },
    // Component tests mount real components, which needs the browser build of
    // svelte. Without this every `mount()` here dies on
    // `lifecycle_function_unavailable` and `onMount` — how every manager in this
    // package loads its data — never runs. The quiet half of the same switch:
    // `$effect` and `$effect.root` become no-ops that discard the callback
    // unread, so a future effect-driven test would report green while measuring
    // nothing. Two knobs, one loud and one silent: the per-file
    // `// @vitest-environment jsdom` docblock selects vitest's web transform
    // mode, which is the only mode that consults `resolve.conditions` at all.
    // Same reasoning as packages/blocks, table, docs and i18n; scoped to test
    // runs, since this config loads only under vitest.
    resolve: {
      conditions: ['browser']
    }
  })
);
