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
      handleMissingId: 'warn',
      handleHttpError: ({ path, referrer, message }) => {
        // Live demos render real components (auth pages, breadcrumb) with
        // realistic hrefs — these targets intentionally do not exist in the
        // docs app. Anything else is a genuinely broken link and fails the build.
        const demoLinkTargets = [
          '/auth/login',
          '/auth/register',
          '/auth/forgot-password',
          '/blog',
          '/blog/architecture',
          '/products',
          '/products/headphones',
          '/gallery',
          '/projects',
          '/projects/urbicon-ui',
          '/workspace',
          '/workspace/ui'
        ];
        if (demoLinkTargets.includes(path)) return;
        throw new Error(`${message} — ${path} (linked from ${referrer})`);
      }
    }
  }
};
