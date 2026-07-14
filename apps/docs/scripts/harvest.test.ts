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
  stripHtml
} from './harvest';

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

describe('extractIdBlocks', () => {
  it('captures outermost id-bearing blocks and does not close on a nested tag', () => {
    const blocks = extractIdBlocks(extractMain(componentPage) ?? '', 'section');
    expect(blocks.map((b) => b.id)).toEqual(['accessibility', 'api']);
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
    expect(records.map((r) => r.a)).toEqual(['accessibility', 'api']);
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

    expect(merged).toHaveLength(2);
    const apiRecord = merged.find((r) => r.a === 'api');
    expect(apiRecord?.k).toBe('api');
    expect(apiRecord?.b).toContain('Visual-only third state');
    expect(apiRecord?.b).not.toContain('Loading');
  });

  it('keeps prose records that have no API counterpart', () => {
    const merged = mergeRecords(harvestHtml(componentPage, '/x'), []);
    expect(merged.map((r) => r.a)).toEqual(['accessibility', 'api']);
  });
});
