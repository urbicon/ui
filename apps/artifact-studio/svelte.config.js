import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [vitePreprocess()],
  kit: {
    // adapter-auto: das Studio läuft ausschließlich über `vite dev`. Es braucht
    // einen Serverprozess (API-Key, Werkzeug-Loop, Vite-Build je Version) und
    // ist ausdrücklich nicht für ein Deploy gedacht — siehe README.
    adapter: adapter()
  }
};
