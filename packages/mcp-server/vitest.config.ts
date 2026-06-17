import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // zod@4's ESM layout needs to be inlined so vitest's vite-ssr runner
    // resolves the named export correctly; otherwise `z.string` comes back
    // as undefined inside the tool modules.
    server: {
      deps: {
        inline: ['zod']
      }
    },
    include: ['src/**/*.test.ts']
  }
});
