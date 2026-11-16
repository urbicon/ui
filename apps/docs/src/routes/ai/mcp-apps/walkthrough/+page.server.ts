import { SITE_URL } from '#lib/seo.js';
import { renderGuide, repoFile } from '#lib/server/guide-markdown.js';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const prerender = true;

const WALKTHROUGH_MD_PATH = repoFile('packages', 'mcp-app', 'docs', 'WALKTHROUGH.md');

export const load: PageServerLoad = () =>
  renderGuide(WALKTHROUGH_MD_PATH, {
    // `../README.md#…` resolves in the tarball and on GitHub; here the README
    // is the reference route next to this one.
    rewriteLink: (href) => {
      const readme = /^\.\.\/README\.md(#.*)?$/.exec(href);
      if (readme) return `${resolve('/ai/mcp-apps/reference')}${readme[1] ?? ''}`;
      return href.startsWith(`${SITE_URL}/`) ? href.slice(SITE_URL.length) : href;
    }
  });
