import { describe, expect, it } from 'vitest';
import { componentData } from './__fixtures__/checkbox-api';
import {
  decodeEntities,
  extractIdBlocks,
  extractMain,
  extractPageTitle,
  harvestApi,
  harvestHtml,
  mergeRecords,
  stripHtml,
  stripPlaceholderChrome
} from './harvest';

/**
 * A prerendered CodePanel, verbatim in shape from `dist` (classes elided): the
 * toolbar, then the collapse wrapping the loading placeholder that stands in for
 * the code until the `$effect` highlights it. The scope hashes (`svelte-xxx`)
 * are per-build and deliberately not matched on.
 */
const codePanel = `<div class="border-t border-border-hairline svelte-1nx7glw"><div class="flex items-center gap-2 px-4 py-2 svelte-1nx7glw"><button type="button" class="font-meta" aria-expanded="true"><svg class="size-3.5" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"></path></svg> <span class="meta-marker svelte-1nx7glw">svelte</span> <span class="sr-only">Hide Code</span></button> <span class="text-xs svelte-1nx7glw" aria-hidden="true">·</span> <button type="button" class="font-meta" aria-label="Copy" disabled="">Copy <span aria-hidden="true">↗</span></button> <span class="sr-only" role="status"></span></div> <div class="grid transition-[grid-template-rows]" style="grid-template-rows: 1fr"><div class="overflow-hidden"><!--[0--><div class="flex items-center justify-center gap-2 p-8 svelte-1nx7glw" aria-live="polite"><div class="inline-flex svelte-a9agkl" role="status" aria-label="Loading..." aria-live="polite" aria-busy="true"><svg class="animate-spin" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg> <span class="sr-only svelte-a9agkl">Loading...</span></div> <span class="text-sm text-text-secondary svelte-1nx7glw">Loading syntax highlighting...</span></div><!--]--></div></div></div>`;

/**
 * Mirrors the real prerendered output: a sidebar outside `<main>`, Svelte
 * hydration comments, a `Section.svelte` header (`<h2 id="{id}-title">` with an
 * editorial marker span), a nested `<section>` without an id, and a Tailwind
 * arbitrary variant carrying a literal `>` inside the class attribute.
 */
const componentPage = `<!doctype html><html><head><title>Checkbox Component – Urbicon UI</title></head><body>
<nav><a href="/blocks/primitives/accordion">Accordion</a><a href="/blocks/primitives/toggle">Toggle</a></nav>
<main><!--[--><h1>Checkbox</h1>
<section id="accessibility" class="relative" aria-labelledby="accessibility-title"><!--[0-->
  <header><h2 id="accessibility-title" class="text-lg"><span class="select-none">04</span> Accessibility</h2></header>
  <div class="[&>span]:font-bold [&>p]:text-base"><p>Keyboard Tab to focus, Space to toggle. The focus ring is drawn with focus-visible.</p>
  <section class="nested"><p>Nested prose stays with its parent section.</p></section></div>
<!--]--></section>
<section id="usage" aria-labelledby="usage-title"><header><h2 id="usage-title">06 Usage</h2></header><p>Bind the checked state.</p>${codePanel}</section>
<section id="api" aria-labelledby="api-title"><header><h2 id="api-title">05 API</h2></header><table><tr><th>Prop</th></tr></table>Loading</section>
<!--]--></main>
<footer>Imprint</footer></body></html>`;

/** A `customization/**`-shaped page: no `<section id>`, only anchored `<h2 id>` headings. */
const prosePage = `<html><head><title>Tokens – Urbicon UI</title></head><body>
<main><h2 id="architecture">Token Architecture</h2><p>Three layers: foundation, semantic, interaction.</p>
<h2 id="dark-mode">Dark Mode Support</h2><p>Design tokens automatically adapt to dark mode using light-dark().</p></main>
</body></html>`;

/** adapter-static writes these for the trailing-slash redirects. */
const redirectStub = `<script>location.href="/blocks";</script><meta http-equiv="refresh" content="0;url=/blocks">`;

describe('decodeEntities', () => {
  it('decodes named, numeric and hex references', () => {
    expect(decodeEntities('Motion &amp; Depth')).toBe('Motion & Depth');
    expect(decodeEntities('&lt;Checkbox /&gt;')).toBe('<Checkbox />');
    expect(decodeEntities('&#39;a&#x27;b')).toBe("'a'b");
  });

  it('leaves unknown references untouched', () => {
    expect(decodeEntities('&bogus; &amp;')).toBe('&bogus; &');
  });
});

describe('stripHtml', () => {
  it('drops comments, scripts, styles and svg', () => {
    const text = stripHtml(
      '<p>a<!--[0--><script>var x=1</script><style>.a{}</style><svg><path/></svg>b</p>'
    );
    expect(text).toBe('a b');
  });

  // Regression: `<[^>]*>` closes on the `>` inside `[&>span]` and leaks the rest
  // of the class list into the indexed text.
  it('does not leak class attributes containing a literal > (Tailwind arbitrary variants)', () => {
    const text = stripHtml('<div class="[&>span]:font-bold [&>p]:text-base">Real prose</div>');
    expect(text).toBe('Real prose');
    expect(text).not.toContain('font-bold');
  });

  it('keeps escaped markup as text', () => {
    expect(stripHtml('<p>&lt;Checkbox checked /&gt;</p>')).toBe('<Checkbox checked />');
  });
});

describe('extractMain / extractPageTitle', () => {
  it('scopes to main so the sidebar is not indexed on every page', () => {
    const main = extractMain(componentPage);
    expect(main).not.toBeNull();
    expect(main).not.toContain('Accordion');
    expect(main).not.toContain('Imprint');
    expect(main).toContain('Accessibility');
  });

  it('returns null for redirect stubs, which have no main', () => {
    expect(extractMain(redirectStub)).toBeNull();
  });

  it('strips the site suffix from the title', () => {
    expect(extractPageTitle(componentPage)).toBe('Checkbox Component');
    expect(extractPageTitle('<title>Motion &amp; Depth – Urbicon UI</title>')).toBe(
      'Motion & Depth'
    );
  });
});

describe('stripPlaceholderChrome', () => {
  // Regression: code is highlighted in an `$effect`, so the prerendered panel is
  // pure shell. It reached 365 of 650 records, where "syntax highlighting" then
  // outranked the pages that document it.
  it('removes the prerendered CodePanel shell whole', () => {
    const text = stripHtml(stripPlaceholderChrome(codePanel));
    expect(text).toBe('');
  });

  it('leaves the prose around a panel intact', () => {
    const text = stripHtml(stripPlaceholderChrome(`<p>Bind the checked state.</p>${codePanel}`));
    expect(text).toBe('Bind the checked state.');
  });

  // The panel is matched by shape because these must survive: /customization
  // documents a copy button, and CodePanel's own page discusses highlighting.
  it('keeps prose that merely talks about copying and syntax highlighting', () => {
    const prose = `<p>Press Copy to copy the snippet. Loading syntax highlighting is deferred.</p>`;
    expect(stripHtml(stripPlaceholderChrome(prose))).toBe(
      'Press Copy to copy the snippet. Loading syntax highlighting is deferred.'
    );
  });

  // A busy element is telling us its text is a placeholder. "Loading..." was in 394 records.
  it('removes a busy region wherever it appears, not only inside a panel', () => {
    const demo = `<div><button>Save <span role="status" aria-busy="true"><span class="sr-only">Loading...</span></span></button><p>Real prose.</p></div>`;
    const text = stripHtml(stripPlaceholderChrome(demo));
    expect(text).toBe('Save Real prose.');
  });

  // A disclosure button and a spinner can coexist without forming a panel;
  // matching them loosely dropped whole documented examples.
  it('does not mistake an unrelated disclosure and spinner for a panel', () => {
    const demo = `<div><div><button aria-expanded="true">Details</button></div><div><p>Kept prose.</p><span aria-busy="true">x</span></div></div>`;
    expect(stripHtml(stripPlaceholderChrome(demo))).toBe('Details Kept prose.');
  });

  it('survives a stray close tag without throwing or eating content', () => {
    expect(stripHtml(stripPlaceholderChrome('<p>a</p></div><p>b</p>'))).toBe('a b');
  });
});

describe('extractIdBlocks', () => {
  it('captures outermost id-bearing blocks and does not close on a nested tag', () => {
    const blocks = extractIdBlocks(extractMain(componentPage) ?? '', 'section');
    expect(blocks.map((b) => b.id)).toEqual(['accessibility', 'usage', 'api']);
    expect(blocks[0].inner).toContain('Nested prose stays with its parent section');
  });

  it('does not index a nested id-bearing block twice', () => {
    const blocks = extractIdBlocks(
      '<section id="outer">a<section id="inner">b</section></section>',
      'section'
    );
    expect(blocks.map((b) => b.id)).toEqual(['outer']);
  });
});

describe('harvestHtml', () => {
  it('emits one record per section, deep-linking to route#anchor', () => {
    const records = harvestHtml(componentPage, '/blocks/primitives/checkbox');
    expect(records.map((r) => r.a)).toEqual(['accessibility', 'usage', 'api']);
    const a11y = records[0];
    expect(a11y.r).toBe('/blocks/primitives/checkbox');
    expect(a11y.t).toBe('Accessibility');
    expect(a11y.p).toBe('Checkbox Component');
    expect(a11y.k).toBe('prose');
    expect(a11y.b).toContain('focus ring');
  });

  it('drops the editorial marker from the heading', () => {
    const [a11y] = harvestHtml(componentPage, '/x');
    expect(a11y.t).not.toContain('04');
  });

  // Without this the whole customization/** tree — 8 pages of conceptual prose,
  // and the only page documenting dark mode — is unreachable.
  it('falls back to anchored headings on pages with no section ids', () => {
    const records = harvestHtml(prosePage, '/customization/tokens');
    expect(records.map((r) => r.a)).toEqual(['architecture', 'dark-mode']);
    expect(records[1].b).toContain('light-dark()');
  });

  // Regression: the title was recomputed from the first 8 words of heading+body,
  // so all 32 records on the 5 heading-chunk pages were labelled with a sentence
  // cut off mid-word — and the leaked body words scored as title words (100 vs 12),
  // which floated a link list above the page a query was actually about.
  it('titles a heading chunk with the heading, not the prose that follows it', () => {
    const records = harvestHtml(prosePage, '/customization/tokens');
    expect(records.map((r) => r.t)).toEqual(['Token Architecture', 'Dark Mode Support']);
    expect(records[1].b).toContain('Design tokens automatically adapt');
  });

  it('strips the CodePanel shell out of a section record', () => {
    const usage = harvestHtml(componentPage, '/x').find((r) => r.a === 'usage');
    expect(usage?.b).toBe('06 Usage Bind the checked state.');
  });

  it('returns nothing for a redirect stub', () => {
    expect(harvestHtml(redirectStub, '/blocks/primitives')).toEqual([]);
  });
});

describe('harvestApi', () => {
  const [record] = harvestApi(componentData, '/blocks/primitives/checkbox');

  it('anchors the API surface at #api', () => {
    expect(record.r).toBe('/blocks/primitives/checkbox');
    expect(record.a).toBe('api');
    expect(record.k).toBe('api');
    expect(record.t).toBe('Checkbox API');
  });

  it('indexes prop names, their camelCase parts and variant values', () => {
    const names = (record.n ?? '').split(' ');
    expect(names).toContain('oncheckedchange');
    expect(names).toContain('checked');
    expect(names).toContain('change');
    expect(names).toContain('outlined');
  });

  it('indexes prop descriptions, which the prerendered HTML never contains', () => {
    expect(record.b).toContain('Visual-only third state');
    expect(record.b).toContain('Fired after the checked state changes');
  });

  it('includes inherited props', () => {
    expect(record.n).toContain('slotclasses');
  });

  it('emits nothing for a module with no props and no variants', () => {
    expect(harvestApi({ name: 'Components' }, '/docs/components')).toEqual([]);
  });
});

describe('mergeRecords', () => {
  // The prerendered #api section exists but holds only "Loading" placeholders.
  it('lets the API record win over the empty prerendered #api section', () => {
    const prose = harvestHtml(componentPage, '/blocks/primitives/checkbox');
    const api = harvestApi(componentData, '/blocks/primitives/checkbox');
    const merged = mergeRecords(prose, api);

    expect(merged).toHaveLength(3);
    const apiRecord = merged.find((r) => r.a === 'api');
    expect(apiRecord?.k).toBe('api');
    expect(apiRecord?.b).toContain('Visual-only third state');
    expect(apiRecord?.b).not.toContain('Loading');
  });

  it('keeps prose records that have no API counterpart', () => {
    const merged = mergeRecords(harvestHtml(componentPage, '/x'), []);
    expect(merged.map((r) => r.a)).toEqual(['accessibility', 'usage', 'api']);
  });
});
