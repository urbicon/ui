import { SITE_URL } from '$lib/seo';

export const prerender = true;

// Route list derived from the file system at build time: every +page.svelte is
// a static route (no dynamic segments in this app). test-fixtures and the
// scaffold template are internal; the redirect routes (/blocks/primitives,
// /blocks/components) have no +page.svelte and therefore don't appear.
// Imprint/privacy are noindex (mandatory legal pages only) and thus don't
// belong in the sitemap. /semantic-radii is an internal, unlinked design
// reference (noindex).
const NOINDEX_ROUTES = new Set(['/imprint', '/privacy', '/semantic-radii']);
const pages = Object.keys(import.meta.glob('/src/routes/**/+page.svelte'))
  .map((path) => path.replace('/src/routes', '').replace(/\/\+page\.svelte$/, '') || '/')
  .filter((route) => !route.startsWith('/test-fixtures') && !route.includes('/_template'))
  .filter((route) => !NOINDEX_ROUTES.has(route))
  .sort();

export const GET = () => {
  const urls = pages
    .map((route) => `  <url><loc>${SITE_URL}${route === '/' ? '' : route}</loc></url>`)
    .join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' }
  });
};
