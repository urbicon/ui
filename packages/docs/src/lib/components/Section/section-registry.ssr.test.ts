import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import EdgeHarness from './__fixtures__/EdgeHarness.svelte';
import RegistryHarness from './__fixtures__/RegistryHarness.svelte';

/**
 * The table of contents on the server, where no effect runs and a derived is
 * evaluated once, at its first read. The page's sections register while they
 * render, so the rail has to render after them; one rendered before them would
 * serialise an empty list, and this is the check that it does not.
 */

function serverHtml(props: { showCustomization?: boolean; withoutLayout?: boolean } = {}) {
  return render(RegistryHarness, { props }).body;
}

/** Text content: tags and Svelte's hydration comments dropped, whitespace collapsed. */
const textOf = (html: string) =>
  html
    .split(/<!--[\s\S]*?-->|<[^>]+>/)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();

/** The rail's entries as the server wrote them. */
function rail(html: string) {
  const aside = /<aside\b[^>]*data-docs-toc[^>]*>([\s\S]*?)<\/aside>/.exec(html)?.[1] ?? '';
  const nav = /<nav\b[^>]*>([\s\S]*?)<\/nav>/.exec(aside)?.[1] ?? '';
  return [...nav.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map(
    ([, href, inner]) => ({
      href,
      label: textOf(inner),
      lang: /\blang="([^"]*)"/.exec(inner)?.[1] ?? null
    })
  );
}

/** `id → marker` for every section heading that opens with a number. */
function markers(html: string): Record<string, string> {
  const stamp =
    /<h\d\b[^>]*\bid="([^"]+)-title"[^>]*>(?:<!--[^>]*-->|\s)*<span\b[^>]*>(\d+)<\/span>/g;
  return Object.fromEntries([...html.matchAll(stamp)].map(([, id, number]) => [id, number]));
}

describe('section registry — server render', () => {
  it('writes the whole table of contents, in render order, under the headings', () => {
    const html = serverHtml();

    expect(rail(html)).toEqual([
      { href: '#playground', label: 'Playground', lang: null },
      { href: '#examples', label: 'Examples', lang: null },
      // A heading drawn by a snippet is the entry's label too, `lang` and all.
      { href: '#api', label: 'API-Referenz', lang: 'de' },
      { href: '#installation', label: 'Installation', lang: null }
    ]);
  });

  it('numbers the sections that ask, in render order', () => {
    const html = serverHtml();

    // The playground asks for no marker; the nested section takes none.
    expect(markers(html)).toMatchObject({ examples: '01', api: '02', installation: '03' });
    expect(markers(html)).not.toHaveProperty('playground');
    expect(markers(html)).not.toHaveProperty('nested');
  });

  it('keeps sections shown in a demo stage out of the page', () => {
    const html = serverHtml();
    const hrefs = rail(html).map((entry) => entry.href);

    expect(hrefs).not.toContain('#stage-demo');
    expect(hrefs).not.toContain('#example-demo');
    expect(hrefs).not.toContain('#nested');
    // Each stage counts for itself, so a numbered demo shows what a page shows.
    expect(markers(html)).toMatchObject({ 'stage-demo': '01', 'example-demo': '01' });
  });

  it('places a conditional section where it renders', () => {
    const html = serverHtml({ showCustomization: true });

    expect(rail(html).map((entry) => entry.href)).toEqual([
      '#playground',
      '#examples',
      '#customization',
      '#api',
      '#installation'
    ]);
    expect(markers(html)).toMatchObject({
      examples: '01',
      customization: '02',
      api: '03',
      installation: '04'
    });
  });

  it('leaves a section without a heading out', () => {
    const html = serverHtml();

    expect(html).toContain('id="untitled"');
    expect(rail(html).map((entry) => entry.href)).not.toContain('#untitled');
  });

  it('writes the strip control too, before the sections it lists', () => {
    // Its popover lists the sections only once opened, in the browser; the
    // button itself is server markup, shown by CSS while the rail exists.
    const html = serverHtml();

    expect(html).toContain('data-docs-scrollspy');
  });

  it('renders neither a list nor a number without a layout', () => {
    const html = serverHtml({ withoutLayout: true });

    expect(html).not.toContain('data-docs-toc');
    // The two stages still count for themselves.
    expect(Object.keys(markers(html)).sort()).toEqual(['example-demo', 'stage-demo']);
  });

  it('lists a repeated id once, as the browser does, so hydration keeps the rail', () => {
    const html = render(EdgeHarness, { props: { s: { shape: 'repeat' } } }).body;

    expect(rail(html).map((entry) => entry.href)).toEqual(['#examples', '#usage']);
  });

  it('lists the titled sections inside a section without a heading at its level', () => {
    const html = render(EdgeHarness, { props: { s: { shape: 'headless' } } }).body;

    expect(rail(html).map((entry) => entry.href)).toEqual([
      '#intro',
      '#grouped-a',
      '#grouped-b',
      '#end'
    ]);
    expect(markers(html)).toEqual({ intro: '01', 'grouped-a': '02', 'grouped-b': '03', end: '04' });
  });
});
