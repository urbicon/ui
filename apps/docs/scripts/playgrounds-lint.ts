#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Glob } from 'bun';
/**
 * Guard over the playgrounds' code snippets.
 *
 * The snippet under a playground is what a reader copies. Two ways it lies,
 * both of them silent, both of them found in the wild before this existed:
 *
 * 1. A control in `extra` that is really a prop. `extra` means "steers the
 *    demo, is not a prop", and `deriveControls` marks everything there
 *    `demoOnly` — so a prop filed under `extra` disappears from the snippet
 *    without a trace. It belongs in `overrides` with an explicit `type`.
 *    (Nineteen controls were mis-filed this way.)
 *
 * 2. A demo that passes declared data the snippet never shows. A `<Table />`
 *    without `columns` and `items` is not something anyone can run. Such a
 *    playground has to declare `codeSetup`.
 *
 * 3. A demo whose content is **markup** — a Card's header snippet, a
 *    SegmentGroup's items — without `source`. Those snippets read `<Card />`,
 *    true and useless. `source={playgroundSource}` lets the configurator lift
 *    the children out of the playground's own text; this check makes forgetting
 *    it loud, since the snippet still renders, just emptier than it should.
 *
 * 4. A knob whose hint is prop documentation rather than playground help. The
 *    hint under a control reads `summary ?? description`, and a `@description`
 *    is written for an agent reading `llm.txt` — `CurrencyInput.locale` ran 597
 *    characters on SSR hydration and `Intl.NumberFormat` internals beside a
 *    three-way switch. `@summary` on the prop is the short form; this check is
 *    what keeps the next long one from arriving unnoticed, which is exactly how
 *    Scroller shipped six of them. Only direct props are read — see the filter
 *    below for why a tv() axis has no hint to be too long.
 *
 * All checks are static — they read the playground sources and the generated
 * `api.ts` next to them. What they cannot see is a prop that reaches the
 * component through a spread (`Input`'s `placeholder` via `HTMLAttributes`);
 * those live in ACCEPTED_EXTRAS below, each with the reason it is there.
 */
// Straight from the source, not the package barrel: importing `@urbicon-ui/docs`
// pulls its Svelte components, and `$state` is not defined outside a compiled
// component — the whole lint died on a `toast.store.svelte.js` top-level store.
import { extractChildMarkup } from '../../../packages/docs/src/lib/components/PlaygroundConfigurator/extract-markup';
import {
  closingIndex,
  controlKeysOf,
  describeUnshownData,
  HINT_BUDGET,
  IDENTIFIER
} from './playgrounds-lint.rules';

const ROUTES = join(import.meta.dir, '..', 'src', 'routes');

/**
 * `extra` entries that are props even though `api.ts` does not list them —
 * they arrive through a spread or a forwarded variant. Reviewed by hand; the
 * snippet shows them, which is why they are not `demoOnly`.
 */
const ACCEPTED_EXTRAS = new Set<string>([]);

/** Attributes that belong to the docs page, not to the component's API. */
const SCAFFOLD = /^(class|style|slotClasses|aria-[\w-]+|data-[\w-]+)$/;

/**
 * Identifiers that are docs-site plumbing and must not reach a snippet.
 *
 * `dateLocale` was here until 2026-07-31: the date playgrounds each derived a
 * BCP 47 tag from the page locale and passed it, because the components
 * defaulted to a hardcoded `'de-DE'` and could not see the provider. They follow
 * it themselves now, so the workaround is gone and the entry with it — a stale
 * name here would quietly excuse the next one.
 */
const SITE_ONLY = new Set(['CONTAINED']);

const problems: string[] = [];
let checked = 0;

for await (const rel of new Glob('{blocks,table,auth}/**/Playground.svelte').scan(ROUTES)) {
  const file = join(ROUTES, rel);
  const src = readFileSync(file, 'utf8');
  const component = src.match(/componentName="([^"]+)"/)?.[1];
  if (!component) continue; // re-export pointer (the Guide surfaces)
  checked++;

  const apiPath = join(dirname(file), 'api.ts');
  const componentData = (await import(apiPath)).componentData;
  type ApiProp = {
    name: string;
    description?: string;
    summary?: string;
    source?: { type?: string };
  };
  const allProps = (componentData.props ?? []) as ApiProp[];
  // Only props that reach `propDocs` in `extractPlaygroundDocs`, which is the
  // one that decides what a knob shows. A tv() axis gets the "V" badge and no
  // hint at all — its description is generated boilerplate ("Determines the
  // component's visual treatment. Available options: …") and the dropdown
  // beside it already lists the values. Measured on the Checkbox page: of
  // `variant`/`intent`/`size`/`tier`/`mint`/`checked`/`indeterminate`, only the
  // direct props rendered a hint line. Reading `props` without this filter
  // reports 56 knobs that show no hint to anyone.
  const hintProps = new Map<string, ApiProp>(
    allProps.filter((p) => p.source?.type !== 'variant').map((p) => [p.name, p])
  );
  const propNames = new Set<string>([
    ...allProps.map((p) => p.name),
    ...(componentData.variants ?? []).map((v: { name: string }) => v.name)
  ]);

  // ── 1. `extra` must hold no props ──────────────────────────────────────
  const extraAt = src.indexOf('extra: [');
  if (extraAt >= 0) {
    const from = src.indexOf('[', extraAt);
    const body = src.slice(from, closingIndex(src, from, '[', ']'));
    for (const m of body.matchAll(/key: '([^']+)'/g)) {
      const key = m[1];
      if (propNames.has(key) && !ACCEPTED_EXTRAS.has(`${component}.${key}`)) {
        problems.push(
          `${rel}\n    \`extra\` holds "${key}", which is a prop of ${component}. Everything in ` +
            `\`extra\` is marked demoOnly and never reaches the snippet — move it to ` +
            `\`overrides.${key}\` (with a \`type\` if the extractor cannot resolve it).`
        );
      }
    }
  }

  // ── 2. A knob's hint must be help, not the prop's contract ─────────────
  const { keys, selfDocumented } = controlKeysOf(src);
  for (const key of keys) {
    if (selfDocumented.has(key)) continue;
    const prop = hintProps.get(key);
    if (!prop) continue; // a tv() axis, or a key the extractor could not resolve
    // What the panel renders, which is what the reader has to get through.
    const hint = prop.summary ?? prop.description ?? '';
    if (hint.length <= HINT_BUDGET) continue;
    problems.push(
      `${rel}\n    The "${key}" knob shows ${hint.length} characters of hint, the budget is ` +
        `${HINT_BUDGET}. Add \`@summary\` to ${component}'s \`${key}\` prop in its \`index.ts\` — ` +
        `one sentence saying what the knob does. \`@description\` stays as it is; it is the ` +
        `contract for \`llm.txt\` and the MCP catalog, and only the panel needs the short form.`
    );
  }

  // ── 3. A demo passing declared data needs a `codeSetup` ────────────────
  const snippetAt = src.indexOf('{#snippet children(');
  if (snippetAt < 0) continue;
  const body = src.slice(src.indexOf('}', snippetAt) + 1, src.lastIndexOf('{/snippet}'));
  const tag = body.match(new RegExp(`<${component}\\b([\\s\\S]*?)(/>|>)`, 'm'));
  if (!tag) continue;
  const attrs = tag[1];

  const script = src.slice(0, src.indexOf('</script>'));
  const declared = new Set([
    ...[...script.matchAll(/^\s{2}(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1]),
    ...[...script.matchAll(/^\s{2}function\s+([A-Za-z_$][\w$]*)/gm)].map((m) => m[1])
  ]);

  const passed: string[] = [];
  for (let i = 0; i < attrs.length; i++) {
    if (attrs[i] !== '{') continue;
    const end = closingIndex(attrs, i, '{', '}');
    const expr = attrs.slice(i + 1, end).trim();
    // A shorthand (`<Foo {data} />`) has no `key=` before the brace — the
    // attribute name *is* the expression, and it is the shortest way to pass
    // demo data, so it has to be read as one.
    const shorthand = IDENTIFIER.test(expr);
    const key = attrs.slice(0, i).match(/([\w:$-]+)=$/)?.[1] ?? (shorthand ? expr : '');
    i = end;
    if (!key || SCAFFOLD.test(key)) continue;
    const shown = describeUnshownData(expr, declared, SITE_ONLY);
    if (!shown) continue;
    passed.push(shorthand ? `{${expr}}` : `${key}={${shown}}`);
  }

  // `{codeSetup}` counts too: a playground whose setup depends on something
  // reactive builds it as a `$derived` and passes it by shorthand.
  const hasSetup = /\bcodeSetup=|\{codeSetup\}/.test(src) || src.includes('codeGenerator');
  if (passed.length && !hasSetup) {
    problems.push(
      `${rel}\n    The demo passes ${passed.join(', ')}, but the snippet cannot show it. ` +
        `Declare \`codeSetup\` — \`consts\` for data, \`state\` for what a \`bind:\` writes back. ` +
        `If the data follows a control, bind the values (\`bind:values\`) and build \`consts\` ` +
        `from them, so the printed object is the one on the stage.`
    );
  }

  // ── 4. A demo with markup children needs `source` ──────────────────────
  // Asks the extractor itself rather than re-deriving "has children": one
  // definition of what counts, and it is the one the snippet actually uses.
  const declaredForSnippet: string[] = [];
  for (const field of ['consts', 'state'] as const) {
    const at = src.indexOf(`${field}: {`);
    if (at < 0) continue;
    const from = src.indexOf('{', at);
    const block = src.slice(from + 1, closingIndex(src, from, '{', '}'));
    // Entry names, `{ demo }` shorthand included — the first form the guard met
    // in the wild, and a `key:`-only regex called every one of them missing.
    //
    // The trailing separator is a LOOKAHEAD, not a match: consuming it ate the
    // comma that the next entry needs to anchor on, so `{ label, cards }`
    // reported only `label` and the second name came back as undeclared. Every
    // shorthand `consts` in the wild had exactly one entry, so the bug sat
    // dormant until one had two.
    for (const m of block.matchAll(/(?:^|,)\s*([A-Za-z_$][\w$]*)\s*(?=[:,}]|$)/g)) {
      declaredForSnippet.push(m[1]);
    }
  }
  for (const m of src.matchAll(/(?:bind|twoWay): \[([^\]]*)\]/g)) {
    for (const n of m[1].matchAll(/'([^']+)'/g)) declaredForSnippet.push(n[1]);
  }

  const extracted = extractChildMarkup(src, component, declaredForSnippet);
  const hasSource = /\bsource=\{playgroundSource\}/.test(src);
  // A `children` control already puts the reader's own text between the tags
  // (and wins over extraction in `generateDefaultCode`) — Alert derives its body
  // from `values.children`, so its markup is shown, just by the other path.
  const hasChildrenControl = /['"]children['"]/.test(src);
  if (extracted.markup && !hasSource && !hasChildrenControl && !src.includes('codeGenerator')) {
    problems.push(
      `${rel}\n    The demo puts markup inside <${component}>, but the snippet shows none of it. ` +
        `Add \`import playgroundSource from './Playground.svelte?raw';\` and ` +
        `\`source={playgroundSource}\`. (Not \`self\` — that is \`window.self\`, so a missing ` +
        `import type-checks and silently passes the Window object.)`
    );
  }
  if (hasSource && extracted.unresolved.length > 0) {
    problems.push(
      `${rel}\n    The child markup refers to ${extracted.unresolved.join(', ')}, which the ` +
        `snippet does not declare — so it is dropped at runtime and the snippet stays empty. ` +
        `Add them to \`codeSetup.consts\`/\`state\`, or rename the playground's binding to match one.`
    );
  }
}

if (problems.length) {
  console.error(`\n✗ ${problems.length} playground snippet problem(s):\n`);
  for (const p of problems) console.error(`  ${p}\n`);
  process.exit(1);
}
console.log(
  `✓ ${checked} playgrounds: no mis-filed extras, every knob hint within ${HINT_BUDGET} chars, ` +
    `no unshown demo data, no hidden child markup.`
);
