import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Marked } from 'marked';
import { slugify } from '../../../../../scripts/github-slug.js';

/**
 * The site channel of the one-source model in docs/DOCS-SURFACES.md: a route
 * renders a guide that ships in a package tarball, at prerender time, so the
 * site page and `urbicon guide` read the same file.
 */

export interface GuideHeading {
  id: string;
  text: string;
}

export interface RenderedGuide {
  /** The document's h1, which the page shows as its own header. */
  title: string;
  html: string;
  /** The document's h2s, in order — the page's section nav. */
  headings: GuideHeading[];
}

export interface RenderGuideOptions {
  /**
   * Where a link in the document points on this site. A link that resolves in
   * the tarball (`../README.md`, `./docs/…`) does not resolve here, so each
   * route maps its document's relative links; anything else passes through.
   */
  rewriteLink?: (href: string) => string;
}

/** An absolute path to a file of this repo, from the docs app's working directory. */
export function repoFile(...segments: string[]): string {
  return resolve(process.cwd(), '..', '..', ...segments);
}

/** Strip markdown inline syntax from a heading for the nav text (GitHub keeps code-span content). */
function plainHeadingText(raw: string): string {
  return raw
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\*([^*]*)\*/g, '$1')
    .trim();
}

export function renderGuide(path: string, options: RenderGuideOptions = {}): RenderedGuide {
  const rewriteLink = options.rewriteLink ?? ((href: string) => href);
  const markdown = readFileSync(path, 'utf-8');

  let title = '';
  const headings: GuideHeading[] = [];
  // Ids as `docs:refs:check` resolves `FILE.md#anchor` links: GitHub's slug,
  // a repeat suffixed -1, -2, … counted over every heading, the h1 included.
  const seen = new Map<string, number>();

  const marked = new Marked();
  marked.use({
    renderer: {
      heading({ tokens, depth, text }) {
        const base = slugify(text);
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        const id = count === 0 ? base : `${base}-${count}`;
        const plain = plainHeadingText(text);
        // The page shows the h1 as its header; two h1s would be an a11y regression.
        if (depth === 1) {
          title ||= plain;
          return '';
        }
        if (depth === 2) headings.push({ id, text: plain });
        return `<h${depth} id="${id}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
      link({ href, tokens }) {
        const inline = this.parser.parseInline(tokens);
        const target = rewriteLink(href);
        const external = /^https?:\/\//.test(target);
        const rel = external ? ' rel="noopener"' : '';
        return `<a href="${target}"${rel}>${inline}</a>`;
      }
    }
  });

  const html = (marked.parse(markdown, { async: false }) as string)
    // A code block or table wider than the column scrolls; a keyboard reaches
    // the scroll only through a focusable region (axe scrollable-region-focusable).
    .replaceAll('<pre>', '<pre tabindex="0">')
    .replaceAll('<table>', '<table tabindex="0">');
  return { title, html, headings };
}
