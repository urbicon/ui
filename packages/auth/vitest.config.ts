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
      // Not a copy: every component in this package is built out of blocks
      // primitives, so the jsdom gaps it falls into are exactly the ones blocks
      // already patches — one set, maintained where the components that need it
      // live. The file is guarded on `window`, so the node files (the bulk of
      // this suite) load it and skip all of it. It reaches across the package
      // boundary to a path outside blocks' exports map, which is safe only
      // because it is import-free and never published; should it ever gain an
      // import, this run fails loudly on the unresolved specifier rather than
      // quietly losing a polyfill.
      setupFiles: ['../blocks/vitest-setup.ts']
    },
    // Component tests mount real components, which needs the browser build of
    // svelte. Without this every `mount()` here dies on
    // `lifecycle_function_unavailable`, and `onMount` — how every manager in
    // this package loads its data — never runs. It pairs with the per-file
    // `// @vitest-environment jsdom` docblock, which selects the only transform
    // mode that consults `resolve.conditions` at all; see the `blocks-testing`
    // skill for the failure mode when one of the two is missing.
    resolve: {
      conditions: ['browser']
    }
  })
);
