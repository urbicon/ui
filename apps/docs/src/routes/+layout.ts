// Static build: all doc routes are prerendered (SEO). Exceptions
// (test-fixtures, _template) opt out via their own +layout.ts/+page.ts and
// run through the SPA fallback.
export const prerender = true;
