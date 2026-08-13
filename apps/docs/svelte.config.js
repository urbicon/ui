import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  extensions: ['.svelte', '.md', '.svx'],
  preprocess: [vitePreprocess()],
  kit: {
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
  }
};
