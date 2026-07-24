import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts (no SvelteKit plugin): what is left here is the
// demo's own domain logic (the salon tool), pure TypeScript with no DOM and no
// Svelte imports. The A2UI stream/transcript suites moved into
// `@urbicon-ui/blocks` along with the code they cover.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
