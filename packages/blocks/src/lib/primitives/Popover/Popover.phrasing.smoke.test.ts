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

import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Popover from './Popover.svelte';

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
    // The end-to-end shape of the bug, spelled out: wrap the server output the
    // way MdBlock does, then check the paragraph body against the elements whose
    // start tag *implicitly closes* an open <p> per the HTML parsing spec. That
    // list — not "is it a div" — is the actual rule being obeyed here.
    const CLOSES_A_PARAGRAPH = [
      'div',
      'p',
      'ul',
      'ol',
      'li',
      'table',
      'section',
      'article',
      'header',
      'footer',
      'blockquote',
      'form',
      'h1'
    ];
    const body = `See ${renderPopover({ inline: true })} for details.`;
    for (const tag of CLOSES_A_PARAGRAPH) {
      expect(body, `<${tag}> inside a paragraph terminates it`).not.toMatch(
        new RegExp(`<${tag}[\\s/>]`)
      );
    }
  });
});
