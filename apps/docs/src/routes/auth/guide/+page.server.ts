import { renderGuide, repoFile } from '#lib/server/guide-markdown.js';
import type { PageServerLoad } from './$types';

export const prerender = true;

const AUTH_MD_PATH = repoFile('packages', 'auth', 'docs', 'AUTH.md');

export const load: PageServerLoad = () =>
  renderGuide(AUTH_MD_PATH, {
    // Package-relative links resolve in the tarball but not on this site —
    // point them at the package's npm page instead.
    rewriteLink: (href) =>
      href.startsWith('../README.md') ? 'https://www.npmjs.com/package/@urbicon-ui/auth' : href
  });
