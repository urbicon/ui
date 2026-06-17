import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// Inline noop adapter — this package is published as a library, never
// deployed as a SvelteKit app. SvelteKit only runs `adapt()` on `vite
// build`, never on `svelte-kit sync`, so the implementation can be a
// stub. Avoids the `@sveltejs/adapter-auto` devDep entirely.
const noopAdapter = () => ({ name: 'noop', adapt() {} });

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: { adapter: noopAdapter() }
};

export default config;
