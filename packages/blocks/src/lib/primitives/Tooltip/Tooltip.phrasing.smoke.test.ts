/**
 * SSR shape of the tooltip in phrasing content.
 *
 * Same parser rule as `Popover.phrasing.smoke.test.ts`: a `<div>` start tag
 * closes an open `<p>` while the parser repairs the document, so the DOM the
 * browser builds no longer matches the tree the component describes — Svelte
 * emits `node_invalid_placement_ssr`, then `hydration_mismatch`.
 *
 * Tooltip is the component the library documents for exactly this position
 * ("for hover-described inline targets", `llms-full-template.md`), so the fix
 * is unconditional rather than an opt-in mode: there is no configuration in
 * which a tooltip should emit markup that is illegal where it is meant to go.
 *
 * The panel STAYS in the server render — that is the difference from Popover's
 * `inline` mode. Popover withholds its panel because the content is the
 * consumer's and can be any element; a tooltip's `label` is typed `string`, so
 * the panel's content is phrasing by construction and a `<span>` holds it
 * legally. Withholding was not merely unnecessary here but awkward: the panel
 * is mounted so `bind:this` stays stable and Floating UI's arrow middleware
 * always has a target (Tooltip.svelte, above the panel).
 *
 * These run against `render()` from `svelte/server` — the server output is the
 * whole subject. What the client does after mounting is Playwright's job.
 */

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import Tooltip from './Tooltip.svelte';

/**
 * Every element whose start tag implicitly closes an open `<p>`, read from the
 * table Svelte itself consults when it emits `node_invalid_placement_ssr`
 * (`svelte/src/html-tree-validation.js`) — read rather than copied, so this
 * test and the compiler warning can never disagree about what the rule is.
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

const children = createRawSnippet(() => ({ render: () => '<button>save</button>' }));

const renderTooltip = (props: Record<string, unknown> = {}) =>
  render(Tooltip, { props: { children, label: 'Save your changes', ...props } }).body;

describe('Tooltip — phrasing content', () => {
  // Everything the component itself emits. The trigger's *children* are the
  // consumer's and no component change can constrain them — a `<Tooltip>`
  // wrapped around a `<div>` still breaks the paragraph, and that is the
  // consumer's call to make.
  it('emits no <div> of its own — trigger wrapper, panel and arrow', () => {
    const html = renderTooltip();
    expect(
      html,
      'any <div> in the server output closes an enclosing <p>, whatever its nesting depth'
    ).not.toContain('<div');
  });

  it('keeps the panel in the server render, with its id and role', () => {
    // The half Popover's `inline` mode gives up. `aria-describedby` names this
    // id, so an SSR'd page must carry the element it points at: dropping it
    // would make the description resolve to nothing until hydration.
    const html = renderTooltip();
    expect(html).toContain('role="tooltip"');
    expect(html).toMatch(/id="tooltip-[^"]+"/);
    expect(html).toContain('Save your changes');
  });

  it('renders the panel as a span even with the arrow on', () => {
    // `arrow` defaults to true, so the arrow node is in the default output —
    // it was the second <div>, and a nested one is no less fatal to the <p>.
    const html = renderTooltip({ arrow: true });
    expect(html).not.toContain('<div');
    expect(html).toContain('rotate-45');
  });

  it('blockifies the panel through position:fixed, never through a display utility', () => {
    // A <span> is inline-level, and the chip needs block layout for its
    // padding, `max-w-xs` and wrapping. Nothing sets `display` for it: CSS
    // blockifies a fixed-positioned box automatically.
    //
    // The negative half is the load-bearing one. An author-level `display`
    // also beats the UA rule `[popover]:not(:popover-open) { display: none }`,
    // and a closed tooltip then keeps a laid-out fixed box — invisible, but in
    // the a11y tree and findable by find-in-page (measured in Chromium and
    // WebKit, 2026-08-02). So the check covers BOTH places a `display` could
    // enter: the inline style, and the tv() base slot — which is where every
    // other display utility in this library lives, and therefore the only one
    // a maintainer would realistically reach for. Asserting on the inline
    // style alone let `base: ['block', …]` through, green.
    const html = renderTooltip();
    expect(html).toMatch(/style="position: fixed;[^"]*"/);
    expect(html).not.toMatch(/style="[^"]*display:/);

    const panelClass = /<span[^>]*class="([^"]*)"[^>]*role="tooltip"/.exec(html)?.[1];
    expect(panelClass, 'panel class attribute not found — the regex above went stale').toBeTypeOf(
      'string'
    );
    const DISPLAY_UTILITIES = [
      'block',
      'inline-block',
      'inline',
      'flex',
      'inline-flex',
      'grid',
      'inline-grid',
      'flow-root',
      'contents',
      'table',
      'inline-table',
      'list-item',
      'hidden'
    ];
    for (const utility of (panelClass ?? '').split(/\s+/).filter(Boolean)) {
      expect(
        DISPLAY_UTILITIES,
        `\`${utility}\` sets display on the panel, which defeats [popover]:not(:popover-open)`
      ).not.toContain(utility);
    }
  });

  it('a paragraph containing a tooltip survives with its <p> intact', () => {
    // The end-to-end shape of the bug: the documented position for this
    // component, checked against every element whose start tag implicitly
    // closes an open <p>. The list is READ FROM SVELTE, not written out here.
    const body = `See ${renderTooltip()} for details.`;
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
