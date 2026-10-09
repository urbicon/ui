import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import tailwindcss from '@tailwindcss/vite';
import { codeExamplePlugin } from '@urbicon-ui/docs/vite';
import { defineConfig, type Plugin } from 'vite';

const rootPkg = JSON.parse(readFileSync(resolve(__dirname, '../../package.json'), 'utf-8'));

function changelogPlugin(): Plugin {
  let cached: string | undefined;
  const changelogPath = resolve(__dirname, '../../CHANGELOG.md');

  function getChangelogModule(): string {
    if (cached !== undefined) return cached;
    try {
      const content = readFileSync(changelogPath, 'utf-8');
      cached = `export default ${JSON.stringify(content)};`;
    } catch {
      cached = `export default '# Changelog\\n\\nNo changelog available yet.';`;
    }
    return cached;
  }

  return {
    name: 'changelog-loader',
    resolveId(id) {
      if (id === 'virtual:changelog') return '\0virtual:changelog';
    },
    load(id) {
      if (id === '\0virtual:changelog') return getChangelogModule();
    },
    handleHotUpdate({ file }) {
      if (file === changelogPath) cached = undefined;
    }
  };
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(rootPkg.version)
  },
  plugins: [
    changelogPlugin(),
    codeExamplePlugin(),
    tailwindcss(),
    sveltekit({
      extensions: ['.svelte', '.md', '.svx'],
      preprocess: [vitePreprocess()],
      adapter: adapter({
        pages: 'dist',
        assets: 'dist',
        // Not 'index.html': that would overwrite the prerendered landing page.
        // The static server must serve 404.html as the SPA fallback.
        fallback: '404.html',
        precompress: false,
        strict: true
      }),
      prerender: {
        // '*' = all static routes (there are no dynamic segments).
        // test-fixtures/_template opt out via `export const prerender = false`
        // and stay reachable through the SPA fallback.
        entries: ['*'],
        handleMissingId: 'warn'
        // No handleHttpError override: the crawl is strict, so any broken link
        // fails the build. Live previews that render components with their own
        // route links (the auth pages' loginUrl / registerUrl /
        // forgotPasswordUrl, which a *consuming* app owns and this site has no
        // route for) pass a docs-site target at the call site instead — see
        // apps/docs/src/routes/auth/components/*/examples/BasicDemo.svelte and
        // the three auth recipes. Keep it that way: an exemption list here would
        // hide real breakage.
        //
        // A demo that needs an image to *fail* (Avatar's initials fallback) has
        // the same shape: a site-relative dead path like /broken/photo.jpg is
        // indistinguishable from real breakage to the crawler and fails the
        // build. Use an undecodable data: URL instead — `data:image/jpeg,broken`
        // fires onerror with no request to crawl. See the avatar page.
      }
    })
  ],
  build: {
    /**
     * `light-dark()` MUST reach the browser unpolyfilled — the whole token
     * system depends on it resolving late, at the element that USES the value.
     *
     * Vite 8 minifies CSS with Lightning CSS by default (`cssMinify:
     * 'lightningcss'`; Vite 5–7 used esbuild, which never touched this), and
     * against the default target (Safari 16) Lightning CSS downlevels
     * `light-dark(a, b)` into
     *   `var(--lightningcss-light, a) var(--lightningcss-dark, b)`
     * with the two guards set wherever it saw a `color-scheme` declaration.
     * That substitution happens where the custom property is DECLARED, so a
     * token declared at `:root` freezes to the root's scheme and inherits
     * already-resolved — a `color-scheme: dark` further down can no longer
     * change it. Which is precisely what a container-scoped livery is: the
     * Duna tile sits in a light page, and `livery-shim.gen.css` only re-
     * declares the ramp-derived tokens, so everything else (the whole neutral
     * intent, which derives from `--color-warm-neutral-*`) kept the light
     * branch. Measured on ui.urbicon.de: the A2UI button's label rendered
     * `oklch(0.28 0.01 45)` — near-black ink on Duna's dark brown, with
     * `color-scheme: dark` sitting right there in the computed styles — while
     * the same page in dark mode was correct, because there the frozen branch
     * happened to be the right one.
     *
     * These four are the versions that ship `light-dark()` natively, so
     * Lightning CSS passes it through and the resolution stays late.
     */
    cssTarget: ['chrome123', 'edge123', 'firefox120', 'safari17.5']
  },
  optimizeDeps: {
    exclude: ['@tailwindcss/oxide', '@tailwindcss/oxide-darwin-arm64', 'fsevents', 'lightningcss']
  }
});
