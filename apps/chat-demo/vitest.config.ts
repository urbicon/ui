import { defineConfig } from 'vitest/config';

// Standalone from vite.config.ts (no SvelteKit plugin): the splitter tests are
// pure TypeScript with no DOM and no Svelte components, so they run in a plain
// node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
});
