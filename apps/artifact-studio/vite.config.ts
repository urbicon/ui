import adapter from '@sveltejs/adapter-auto';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit({
      preprocess: [vitePreprocess()],
      // adapter-auto: das Studio läuft ausschließlich über `vite dev`. Es braucht
      // einen Serverprozess (API-Key, Werkzeug-Loop, Vite-Build je Version) und
      // ist ausdrücklich nicht für ein Deploy gedacht — siehe README.
      adapter: adapter()
    })
  ],
  server: {
    // Fest, weil die Sandbox-Origin (127.0.0.1:5211) im Frame-Kontrakt steht und
    // ein wanderndes Gegenstück die Zwei-Origin-Prüfung unbemerkt aushebeln würde.
    // Der Sandbox-Server selbst startet in `scripts/dev.ts`, nicht hier — er darf
    // Vites Neustarts nicht mitmachen (Begründung in src/lib/server/sandbox.ts).
    port: 5210,
    strictPort: true
  }
});
