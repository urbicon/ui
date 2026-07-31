/**
 * SSR shape of the `inline` (phrasing-content) mode.
 *
 * A `<div>` start tag closes an open `<p>` — the HTML parser does this while
 * repairing the document, so the DOM the browser builds from the server output
 * no longer matches the tree the component describes. Svelte reports it as
 * `node_invalid_placement_ssr` followed by `hydration_mismatch`, and the page
 * visibly reflows on hydration. Measured 2026-07-28 on three docs pages, all of
 * them rendering a `CitationChip` inside a markdown paragraph.
 *
 * Both halves have to hold at once, which is why they are asserted together:
 * making the trigger a `<span>` while the panel stays a `<div>` fixes nothing,
 * because the panel closes the paragraph just as effectively.
 *
 * These run against `render()` from `svelte/server` — the server output is the
 * whole subject here. What the client does after mounting is Playwright's job.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Popover from './Popover.svelte';

/**
 * Every element whose start tag implicitly closes an open `<p>`, read from the
 * table Svelte itself consults when it emits `node_invalid_placement_ssr`
 * (`svelte/src/html-tree-validation.js`). Read rather than copied, so this test
 * and the compiler warning can never disagree about what the rule is — the
 * first version of this file listed thirteen tags by hand and called them "the
 * rule", missing `hr` and `h2`-`h6` among others.
 *
 * The file is not exported from the package, so it is read off disk. That is
 * also why the count is asserted below: if Svelte moves or reshapes it, the
 * regex yields an empty list and the loop would pass vacuously.
 */
const CLOSES_A_PARAGRAPH: string[] = (() => {
  const src = readFileSync(
    resolve(
      dirname(createRequire(import.meta.url).resolve('svelte/package.json')),
      'src/html-tree-validation.js'
    ),
    'utf8'
  );
  const block = /\bp:\s*\{\s*descendant:\s*\[([^\]]*)\]/s.exec(src);
  return [...(block?.[1] ?? '').matchAll(/'([a-z0-9]+)'/g)].map((m) => m[1]);
})();

const trigger = createRawSnippet(() => ({ render: () => '<button>cite</button>' }));
const children = createRawSnippet(() => ({ render: () => '<span>source</span>' }));

const renderPopover = (props: Record<string, unknown> = {}) =>
  render(Popover, { props: { trigger, children, ...props } }).body;

describe('Popover — phrasing-content mode', () => {
  it('default mode emits the div wrapper and the div panel', () => {
    const html = renderPopover();
    // The baseline this mode is measured against. If either of these stops being
    // a <div>, the `inline` tests below no longer prove anything.
    expect(html).toContain('<div class="inline-flex"');
    expect(html.match(/<div/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('inline mode emits no <div> at all — neither wrapper nor panel', () => {
    const html = renderPopover({ inline: true });
    expect(
      html,
      'any <div> in the server output closes an enclosing <p>, whatever its nesting depth'
    ).not.toContain('<div');
  });

  it('inline mode still renders the trigger, as a span', () => {
    const html = renderPopover({ inline: true });
    expect(html).toContain('<span class="inline-flex"');
    expect(html).toContain('cite');
  });

  it('inline mode withholds the panel from the server render', () => {
    // The panel is deliberately absent until mount: no wrapper element can make
    // it phrasing-safe, because its children are the consumer's. The cost is
    // that a non-rendering crawler never sees the panel content — stated in the
    // `inline` prop's JSDoc so it is a choice, not a surprise.
    const html = renderPopover({ inline: true });
    expect(html).not.toContain('popover=');
    expect(html).not.toContain('role="dialog"');
  });

  it('default mode keeps the panel in the server render', () => {
    // Guards the other direction: `inline` must not quietly become the default,
    // which would strip every popover's panel out of every prerendered page.
    const html = renderPopover();
    expect(html).toContain('role="dialog"');
  });

  it('a paragraph containing an inline popover survives with its <p> intact', () => {
    // The end-to-end shape of the bug: wrap the server output the way MdBlock
    // does, then check the paragraph body against every element whose start tag
    // implicitly closes an open <p>.
    //
    // The list is READ FROM SVELTE, not written out here. A hand-picked subset
    // is how this assertion quietly stops covering things — the first version of
    // this test listed thirteen tags and called them "the rule"; Svelte's own
    // table has 28, including `hr` and `h2`–`h6`, which is exactly the shape a
    // consumer's popover content might hold. Reading the source that Svelte uses
    // to emit `node_invalid_placement_ssr` means this test and the compiler
    // warning can never disagree about what the rule is.
    const body = `See ${renderPopover({ inline: true })} for details.`;
    expect(
      CLOSES_A_PARAGRAPH.length,
      "Svelte's p-descendant list could not be read — the loop below would pass vacuously"
    ).toBeGreaterThan(20);
    for (const tag of CLOSES_A_PARAGRAPH) {
      expect(body, `<${tag}> inside a paragraph terminates it`).not.toMatch(
        new RegExp(`<${tag}[\\s/>]`)
      );
    }
  });
});
