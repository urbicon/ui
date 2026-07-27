import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    // Fest, weil die Sandbox-Origin (127.0.0.1:5211) im Frame-Kontrakt steht und
    // ein wanderndes Gegenstück die Zwei-Origin-Prüfung unbemerkt aushebeln würde.
    // Der Sandbox-Server selbst startet in `scripts/dev.ts`, nicht hier — er darf
    // Vites Neustarts nicht mitmachen (Begründung in src/lib/server/sandbox.ts).
    port: 5210,
    strictPort: true
  }
});
