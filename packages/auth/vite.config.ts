import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vite';

// Inline noop adapter — this package is published as a library, never
// deployed as a SvelteKit app. SvelteKit only runs `adapt()` on `vite
// build`, never on `svelte-kit sync`, so the implementation can be a
// stub. Avoids the `@sveltejs/adapter-auto` devDep entirely.
const noopAdapter = () => ({ name: 'noop', adapt() {} });

export default defineConfig({
  plugins: [sveltekit({ preprocess: vitePreprocess(), adapter: noopAdapter() })]
});
