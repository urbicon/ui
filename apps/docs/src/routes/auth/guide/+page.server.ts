import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Marked } from 'marked';
import type { PageServerLoad } from './$types';

export const prerender = true;

/**
 * Render the canonical, tarball-shipped auth reference
 * (`packages/auth/docs/AUTH.md`) at prerender time — the site channel of the
 * one-source model in docs/DOCS-SURFACES.md. The npm README links here
 * absolutely, so heading anchors must stay GitHub-compatible (see `slugify`).
 */
const AUTH_MD_PATH = resolve(process.cwd(), '..', '..', 'packages', 'auth', 'docs', 'AUTH.md');

/**
 * GitHub-compatible heading slugs (`Known Limitations & Security Gaps` →
 * `known-limitations--security-gaps`): lowercase, drop everything but word
 * characters/spaces/hyphens, spaces become hyphens. Keeps the anchors the
 * package README and AUTH.md's own internal links already use.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\- ]/g, '')
    .replace(/ /g, '-');
}

/** Strip markdown inline syntax from a heading for the slug/nav text (GitHub keeps code-span content). */
function plainHeadingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .trim();
}

export const load: PageServerLoad = () => {
  // Drop the document's own h1 — the page supplies its header, and two h1s
  // would be an a11y regression.
  const markdown = readFileSync(AUTH_MD_PATH, 'utf-8').replace(/^# .+\n/, '');

  const headings: { id: string; text: string }[] = [];

  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const inline = this.parser.parseInline(tokens);
        const plain = plainHeadingText(text);
        const id = slugify(plain);
        if (depth === 2) headings.push({ id, text: plain });
        return `<h${depth} id="${id}">${inline}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const inline = this.parser.parseInline(tokens);
        // Package-relative links resolve in the tarball but not on this site —
        // point them at the package's npm page instead.
        const target = href.startsWith('../README.md')
          ? 'https://www.npmjs.com/package/@urbicon-ui/auth'
          : href;
        const external = /^https?:\/\//.test(target);
        const rel = external ? ' rel="noopener"' : '';
        return `<a href="${target}"${rel}>${inline}</a>`;
      }
    }
  });

  const html = marked.parse(markdown, { async: false }) as string;

  return { html, headings };
};
