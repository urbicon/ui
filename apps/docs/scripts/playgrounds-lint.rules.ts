/**
 * The expression-level rules behind `playgrounds-lint.ts`, in their own file so
 * they can be tested without running the lint (which scans the whole route tree
 * and exits the process).
 */

/** A bare name — the shorthand form `<Foo {data} />` and nothing else. */
export const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

/** Index of the bracket closing the one at `open`, or the end of the string. */
export function closingIndex(src: string, open: number, o: string, c: string): number {
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === o) depth++;
    else if (src[i] === c && --depth === 0) return i;
  }
  return src.length;
}

/** String literal bodies blanked out: their contents are prose, not references. */
export function blankStrings(text: string): string {
  return text.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => ' '.repeat(m.length));
}

/**
 * What an attribute expression hands the component that the snippet would not
 * show — or `null` when there is nothing to show.
 *
 * The first version of this asked only "is the expression *exactly* one of the
 * playground's consts", and several playgrounds walked straight through it: an
 * object literal built in the tag (`reasoning={{ type: 'reasoning', … }}`), a
 * call into a local factory (`toolCall={partFor(values.state)}`), and a
 * fallback chain (`content={content || DEMO}`). All three render data the
 * reader cannot see, which is the thing this check exists to prevent.
 *
 * Callbacks are deliberately exempt. An `onSuccess={() => goto('/')}` is
 * behaviour, not data — it belongs in the snippet only when the playground
 * decides it does, and demanding `codeSetup` for every handler would make the
 * rule noise instead of a guard.
 *
 * @param expr the text between the attribute's braces
 * @param declared top-level names from the playground's `<script>`
 * @param siteOnly names that are docs-site plumbing and never belong in a snippet
 */
export function describeUnshownData(
  expr: string,
  declared: ReadonlySet<string>,
  siteOnly: ReadonlySet<string> = new Set()
): string | null {
  const code = blankStrings(expr);
  // `() => …`, `async () => …`, `function () {…}` — behaviour, see above.
  if (/=>/.test(code) || /^\s*(?:async\s+)?function\b/.test(code)) return null;

  if (/^[{[]/.test(code)) return `${expr.slice(0, 40).replace(/\s+/g, ' ')}…`;

  const refs = [...code.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)]
    .map((m) => m[1])
    .filter((name) => declared.has(name) && !siteOnly.has(name));
  return refs.length > 0 ? [...new Set(refs)].join(', ') : null;
}

/**
 * Characters a knob's hint may run to before it stops being help.
 *
 * Measured, not taste, in the same spirit as `summary-lint`'s component budget:
 * the hint line sits under its control at `text-xs`/12 px with a 336 px text
 * column (the 36 rem control grid less the 12 rem label indent). A probe filled
 * with real hint prose fits 57 characters on one line, 113 on two and 173 on
 * three — but that is the best case, with no word breaking. The hints already
 * on the page averaged ~38 characters per rendered line, and the one that ran
 * 115 characters filled exactly three lines. Past 120 a hint is four lines and
 * up: beside a three-way switch that is a wall, not a hint.
 *
 * The long form is not wrong, it is for someone else — `@description` is the
 * contract an agent reads out of `llm.txt` and the MCP catalog, and it stays
 * whatever length the contract needs. `@summary` is the sentence a human reads
 * next to the knob.
 */
export const HINT_BUDGET = 120;

/**
 * The keys a playground renders as knobs, and the ones that bring their own
 * help text.
 *
 * Two shapes are in the wild: `deriveControls(componentData, { pick: [...] })`,
 * which is 76 of 77, and a hand-written `controls={[{ key: … }]}` array
 * (Scroller). Both end up in the same panel, so both are read here.
 *
 * `extra` is cut out first: everything in it is `demoOnly` — a playground
 * affordance, not a prop — and it has no JSDoc to be long. Rule 1 already
 * guards against a real prop hiding there.
 *
 * A key whose override carries its own `description` is self-documented:
 * `getControlDescription` prefers it over the generated prop docs, so no
 * `@summary` would ever be shown for it.
 */
export function controlKeysOf(src: string): { keys: string[]; selfDocumented: Set<string> } {
  let body = src;
  const extraAt = src.indexOf('extra: [');
  if (extraAt >= 0) {
    const from = src.indexOf('[', extraAt);
    body = src.slice(0, from) + src.slice(closingIndex(src, from, '[', ']'));
  }

  const pick = body.match(/pick:\s*\[([^\]]*)\]/s);
  const keys = pick
    ? [...pick[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1])
    : [...body.matchAll(/key:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);

  // `overrides: { locale: { description: '…' } }` — walk each entry's own
  // braces rather than searching the whole block, or one documented key would
  // absolve every other key beside it.
  const selfDocumented = new Set<string>();
  const overridesAt = body.indexOf('overrides:');
  if (overridesAt >= 0) {
    const from = body.indexOf('{', overridesAt);
    const block = body.slice(from + 1, closingIndex(body, from, '{', '}'));
    for (const m of block.matchAll(/([A-Za-z_$][\w$]*)\s*:\s*\{/g)) {
      const entryFrom = m.index + m[0].length - 1;
      const entry = block.slice(entryFrom, closingIndex(block, entryFrom, '{', '}'));
      if (/\bdescription\s*:/.test(entry)) selfDocumented.add(m[1]);
    }
  }
  // A hand-written control carries its description inline, in the same object.
  if (!pick) {
    for (const m of body.matchAll(/\{[^{}]*\bkey:\s*['"]([^'"]+)['"][^{}]*\}/gs)) {
      if (/\bdescription\s*:/.test(m[0])) selfDocumented.add(m[1]);
    }
  }

  return { keys: [...new Set(keys)], selfDocumented };
}
