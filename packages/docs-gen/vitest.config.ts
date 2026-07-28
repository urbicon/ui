import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // BOTH trees. This package keeps most suites in `tests/`, but two live next
    // to their source (`generators/content/icons.test.ts`,
    // `generators/llm/LLMDocumentationGenerator.test.ts`) — and a `tests/`-only
    // pattern silently excluded them for months, so the package reported a test
    // count that contained neither. They are the sole coverage of their subjects
    // (icon-registry parsing; copying `guides:` into the llms.txt scope index),
    // not duplicates of the same-named `tests/LLMDocumentationGenerator.*`
    // suites, which cover the index/config/type-cap paths instead.
    include: ['tests/**/*.test.ts', 'src/**/*.test.ts'],
    globals: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
