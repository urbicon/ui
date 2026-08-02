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
 * legally. Withholding would have worked here too, but it costs the panel's
 * absence from the prerendered HTML and buys nothing a legal element does not
 * already give.
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
import { tooltipVariants } from './tooltip.variants';

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

/**
 * Every Tailwind utility that writes `display`, plus the escape hatch
 * `[display:…]`. Complete as of Tailwind 4 — the `table-*` family is easy to
 * forget and was missing from the first version of this list.
 */
const DISPLAY_UTILITIES = new Set([
  'block',
  'inline-block',
  'inline',
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'flow-root',
  'contents',
  'list-item',
  'hidden',
  'table',
  'inline-table',
  'table-caption',
  'table-cell',
  'table-column',
  'table-column-group',
  'table-footer-group',
  'table-header-group',
  'table-row-group',
  'table-row'
]);

/**
 * Does this class token write `display`, whatever it is prefixed or marked
 * with? `md:block` and `!block` set it just as `block` does — the first only
 * above a breakpoint, which is worse than never, not better.
 *
 * The variant split has to be bracket-aware, the same way `utilityOf` in
 * `scripts/theme-tokens.ts` is: splitting on the last `:` outright finds the
 * one *inside* `[display:block]` and reduces the token to `block]`, which
 * matches nothing. That is not hypothetical — it is how the arbitrary-property
 * form walked past the first version of this check.
 */
function setsDisplay(token: string): boolean {
  let depth = 0;
  let lastColon = -1;
  for (let i = 0; i < token.length; i++) {
    const ch = token[i];
    if (ch === '[' || ch === '(') depth++;
    else if (ch === ']' || ch === ')') depth--;
    else if (ch === ':' && depth === 0) lastColon = i;
  }
  let utility = token.slice(lastColon + 1);
  if (utility.startsWith('!')) utility = utility.slice(1);
  if (utility.endsWith('!')) utility = utility.slice(0, -1);
  return DISPLAY_UTILITIES.has(utility) || /^\[display:/.test(utility);
}

/**
 * The panel's class list in every arm of every axis, not just the default
 * render — `intent`, `size` and `open` each have arms a default render never
 * emits, and a `display` planted in one of them reaches real consumers.
 */
function everyPanelRendering(): [string, string][] {
  const axes = tooltipVariants.config.variants as Record<string, Record<string, unknown>>;
  const out: [string, string][] = [['defaults', tooltipVariants({}).base()]];
  for (const [axis, arms] of Object.entries(axes)) {
    for (const arm of Object.keys(arms)) {
      const value = arm === 'true' ? true : arm === 'false' ? false : arm;
      out.push([`${axis}=${arm}`, tooltipVariants({ [axis]: value }).base()]);
    }
  }
  return out;
}

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
    // and a closed tooltip then keeps a laid-out fixed box — invisible (the
    // closed variant is `opacity-0`), but in the a11y tree and findable by
    // find-in-page. Measured in Chromium and WebKit, 2026-08-02.
    //
    // This walks the tv() CONFIG, not one rendering. Two earlier versions of
    // this check were walked past: the first read only the inline `style`
    // attribute, and the second read the default render's class list, which
    // misses `display` planted in a non-default arm (`intent="primary"`,
    // `size="lg"`) as well as a prefixed one (`md:block` — and prefixes are
    // this slot's idiom, it already carries `motion-reduce:` and `starting:`).
    const html = renderTooltip();
    expect(html).toMatch(/style="position: fixed;[^"]*"/);
    expect(html).not.toMatch(/style="[^"]*display:/);

    for (const [combo, panelClass] of everyPanelRendering()) {
      for (const cls of panelClass.split(/\s+/).filter(Boolean)) {
        expect(
          setsDisplay(cls),
          `\`${cls}\` (${combo}) sets display on the panel, which defeats [popover]:not(:popover-open)`
        ).toBe(false);
      }
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
