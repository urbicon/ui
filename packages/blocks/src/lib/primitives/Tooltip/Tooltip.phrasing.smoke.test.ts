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
import { compile } from '@tailwindcss/node';
import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { escapeClass } from '../../../../scripts/tailwind-emit';
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
 * Does this class actually declare `display`? Asked of the real Tailwind
 * compiler rather than a list of utility names.
 *
 * Three versions of this check were walked past, each because a hand-written
 * model was narrower than Tailwind: first only the inline `style` attribute,
 * then a name list missing the `table-*` family, then one missing
 * `line-clamp-*` — which emits `display: -webkit-box` (and `line-clamp-none` a
 * literal `display: block`), and is the single most likely thing to be added
 * to a slot whose own comment is about wrapping long labels.
 *
 * The compiler has no such blind spots and needs no maintenance. It also
 * handles variant prefixes and `[display:…]` without a special case, since it
 * simply compiles what it is given.
 */
const compileClass = await (async () => {
  const styleDir = resolve(
    dirname(createRequire(import.meta.url).resolve('../../../../package.json')),
    'src/lib/style'
  );
  const css = [
    "@import 'tailwindcss';",
    readFileSync(resolve(styleDir, 'foundation.css'), 'utf-8'),
    readFileSync(resolve(styleDir, 'semantic.css'), 'utf-8')
  ].join('\n');
  const compiler = await compile(css, { base: styleDir, onDependency: () => {} });
  return (cls: string) => compiler.build([cls]);
})();

/**
 * Classes the compiler cannot answer for, because they are hand-written CSS
 * rather than Tailwind utilities. `blocks-menu--open`, Progress' keyframe
 * classes and Avatar's pulse are the established examples of the pattern, so
 * the tooltip slot could grow one too — and `declaresDisplay` would have no
 * rule to inspect.
 *
 * Each needs a reason and the file that defines it, the same contract
 * `variants-lint.ts` uses. An entry that stops being needed is an error.
 */
const HAND_WRITTEN_CSS: Record<string, string> = {};

function declaresDisplay(cls: string): boolean {
  // Two escape levels. The first — class name to CSS selector — is
  // `escapeClass` from `scripts/tailwind-emit.ts`, not a local copy: that
  // module documents the two ways a naive `[^\w-]` replace gets it wrong (a
  // leading digit needs a hex escape, non-ASCII needs none at all), and a
  // local copy reproducing them turned `2xl:px-4` and `after:content-['✓']`
  // into false alarms here. The second level escapes that result for a regex,
  // and skipping it is silent: `.md\:block` read as a pattern means
  // `.md:block`, which matches nothing.
  const cssName = escapeClass(cls);
  const inPattern = cssName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // as a regex
  const rule = new RegExp(`\\.${inPattern}(?![\\w\\\\-])[^{]*\\{([^}]*)\\}`).exec(
    compileClass(cls)
  );

  // No rule at all is NOT an answer, and treating it as "declares no display"
  // is how the whole check fails open one class at a time. The assembly above
  // is `@import 'tailwindcss'` plus two theme files — it does not carry
  // `index.css`, `interaction.css`, `mint/styles.css` or any component-local
  // `:global` block. Measured: adding `blocks-tooltip-panel` to the base slot
  // with `:global(.blocks-tooltip-panel){display:block}` in Tooltip.svelte
  // left this file 16/16 green while the closed popover computed
  // `display: block` and kept a 90×32 box in Chromium and WebKit.
  if (rule == null) {
    if (cls in HAND_WRITTEN_CSS) return false;
    throw new Error(
      `\`${cls}\` compiles to no rule, so this check cannot tell whether it sets ` +
        'display. If it is hand-written CSS, add it to HAND_WRITTEN_CSS in this ' +
        'file with the file that defines it — do not let it pass silently.'
    );
  }
  return /(?:^|;)\s*display\s*:/.test(rule[1]);
}

/**
 * Every class token that can reach the panel, read from the tv() CONFIG rather
 * than from renderings this test constructs.
 *
 * That distinction is the whole lesson of this check's three rewrites. A walk
 * over renderings only ever sees what it thought to ask for: the default
 * render missed non-default arms, and enumerating one axis at a time still
 * misses a `compoundVariants` entry keyed on two axes (`intent: 'primary',
 * size: 'lg'`), because no single-axis render satisfies it. Reading the config
 * covers the base slot, every arm of every axis, and every compound — and
 * keeps covering them when someone adds an axis.
 */
function everyPanelClass(): [string, string][] {
  const cfg = tooltipVariants.config as {
    slots?: Record<string, unknown>;
    base?: unknown;
    variants?: Record<string, Record<string, unknown>>;
    compoundVariants?: Record<string, unknown>[];
  };
  const out: [string, string][] = [];

  /** Pull the `base` slot's classes out of any of tv()'s accepted shapes. */
  const collect = (where: string, value: unknown): void => {
    if (value == null) return;
    if (typeof value === 'string') {
      for (const cls of value.split(/\s+/).filter(Boolean)) out.push([where, cls]);
      return;
    }
    if (Array.isArray(value)) {
      for (const entry of value) collect(where, entry);
      return;
    }
    if (typeof value === 'object') {
      const base = (value as Record<string, unknown>).base;
      if (base !== undefined) collect(where, base);
    }
  };

  collect('base slot', cfg.slots?.base ?? cfg.base);
  for (const [axis, arms] of Object.entries(cfg.variants ?? {})) {
    for (const [arm, value] of Object.entries(arms)) collect(`${axis}=${arm}`, value);
  }
  for (const [i, compound] of (cfg.compoundVariants ?? []).entries()) {
    collect(`compoundVariants[${i}]`, compound.class ?? compound.className);
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
    // The half Popover's `inline` mode gives up. Not for `aria-describedby`'s
    // sake — that is gated on `open`, so a hover tooltip never carries it in
    // the server output at all (a claim this file made in an earlier round and
    // had already retracted elsewhere). The panel stays because it is mounted
    // for `bind:this` stability and the arrow middleware, and because a
    // `<span>` costs nothing to keep.
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
    // Reads the tv() CONFIG and asks the compiler, because every hand-built
    // version of this check was walked past: the inline `style` attribute
    // alone, then the default render only, then a utility-name list missing
    // `line-clamp-*`, then a per-axis walk that no two-axis compound can
    // trigger.
    const html = renderTooltip();
    expect(html).toMatch(/style="position: fixed;[^"]*"/);
    expect(html).not.toMatch(/style="[^"]*display:/);

    // Positive control on the ORACLE, not just on the input. `declaresDisplay`
    // fails open: anything that degrades the stylesheet assembly above — a
    // moved file, a changed Tailwind entry point, a resolution failure — makes
    // it answer `false` for every class, and this test reports clean while a
    // plain `block` sits in the base slot. Verified by blanking the
    // `@import 'tailwindcss'` line with a real `block` planted: 5 passed,
    // because both guards below count the class *collection*, which is still
    // perfectly intact. This is the one half that depends on an external
    // toolchain rather than on data already in the process, and it was the
    // one half with no guard.
    expect(
      declaresDisplay('block'),
      'the compiler probe cannot see `display: block` — the stylesheet assembly above is broken, so every class below would read as harmless'
    ).toBe(true);
    // `md:block`, not just `block`: a bare class needs no escaping, so it
    // exercises the assembly and nothing else. The two-level selector escape
    // is the part this file calls silent when skipped, and it is the part
    // that has actually regressed — dropping the second level while planting
    // a real `md:block` left all five assertions green.
    expect(
      declaresDisplay('md:block'),
      'the probe cannot see display behind a variant prefix — the selector escaping is broken'
    ).toBe(true);
    expect(
      declaresDisplay('[display:block]'),
      'the probe cannot see an arbitrary display property — the selector escaping is broken'
    ).toBe(true);
    expect(declaresDisplay('opacity-0'), 'the probe reports display for a class without it').toBe(
      false
    );

    const classes = everyPanelClass();
    // The stale half of the HAND_WRITTEN_CSS contract, which the comment on
    // that list claims and nothing implemented — the same "a mechanism that
    // does not exist" defect this file's own history is made of. Trivial
    // while the list is empty; the point is that it stops being trivial the
    // moment someone adds an entry.
    const panelClasses = new Set(classes.map(([, cls]) => cls));
    for (const listed of Object.keys(HAND_WRITTEN_CSS)) {
      expect(
        panelClasses.has(listed),
        `stale HAND_WRITTEN_CSS entry \`${listed}\` — no panel slot references it any more`
      ).toBe(true);
    }

    // Vacuity guard on the input, same reason as the paragraph list below: if
    // tv()'s config shape drifts, `everyPanelClass()` quietly degrades to a
    // handful of entries. Measured 39 tokens from 12 sources.
    expect(classes.length, 'no panel classes read from the config').toBeGreaterThan(20);
    expect(new Set(classes.map(([where]) => where)).size).toBeGreaterThan(5);

    for (const [where, cls] of classes) {
      expect(
        declaresDisplay(cls),
        `\`${cls}\` (${where}) declares display on the panel, which defeats [popover]:not(:popover-open)`
      ).toBe(false);
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
