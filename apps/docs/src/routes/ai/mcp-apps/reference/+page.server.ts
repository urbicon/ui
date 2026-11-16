import { SITE_URL } from '#lib/seo.js';
import { renderGuide, repoFile } from '#lib/server/guide-markdown.js';
import { resolve } from '$app/paths';
import type { PageServerLoad } from './$types';

export const prerender = true;

const README_PATH = repoFile('packages', 'mcp-app', 'README.md');

export const load: PageServerLoad = () =>
  renderGuide(README_PATH, {
    // The README links the walkthrough as `./docs/WALKTHROUGH.md` (the shipped
    // copy) and the site absolutely (npmjs resolves no relative link); both
    // are the walkthrough route here.
    rewriteLink: (href) => {
      const walkthrough = /^(?:\.\/)?docs\/WALKTHROUGH\.md(#.*)?$/.exec(href);
      if (walkthrough) return `${resolve('/ai/mcp-apps/walkthrough')}${walkthrough[1] ?? ''}`;
      return href.startsWith(`${SITE_URL}/`) ? href.slice(SITE_URL.length) : href;
    }
  });
