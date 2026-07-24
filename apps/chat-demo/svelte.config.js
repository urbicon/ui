import adapter from '@sveltejs/adapter-auto';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
export default {
  preprocess: [vitePreprocess()],
  kit: {
    // adapter-auto: this POC runs via `vite dev`; the chat endpoint needs a
    // server, so it is NOT statically prerendered. Build succeeds with no key
    // (the API key is read at runtime — see src/routes/api/chat/+server.ts).
    adapter: adapter()
  }
};
