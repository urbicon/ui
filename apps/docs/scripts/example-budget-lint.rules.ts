/**
 * The counting rules behind `example-budget-lint.ts`, in their own file so they
 * can be tested without walking the route tree (which exits the process).
 *
 * Not to be confused with `examples:lint` in `packages/docs-gen`, which
 * type-checks `@example` JSDoc blocks. This one counts `<CodeExample>` on the
 * documentation pages.
 */

/**
 * Blank every template literal, keeping the length so offsets stay put.
 *
 * The escape alternative has to come FIRST. With `` /`[^`]*`/ `` — or with the
 * classes in the other order — a literal containing `\n` (every multi-line
 * `code={`…`}` prop on these pages) ends the match at the wrong backtick and the
 * blanking runs on past the end of the literal, swallowing real markup after it.
 * Docs pages quote `<CodeExample>` in their own snippets, so this is the
 * difference between counting sections and counting prose.
 */
export function blankQuotedMarkup(src: string): string {
  return (
    src
      .replace(/`(?:\\[\s\S]|[^`\\])*`/g, (m) => ' '.repeat(m.length))
      .replace(/\bcode=\{?"(?:\\[\s\S]|[^"\\])*"\}?/g, (m) => ' '.repeat(m.length))
      .replace(/\bcode=\{?'(?:\\[\s\S]|[^'\\])*'\}?/g, (m) => ' '.repeat(m.length))
      // HTML comments — a commented-out example is not an example.
      .replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length))
  );
}

/**
 * Every local name `Section` is imported under on this page.
 *
 * Matching by shape ("every alias ends in Section") misses `SectionComponent`
 * and mis-counts `MenuSection`; reading the import is the actual answer. Same
 * reasoning as `sections-lint.ts`, which learned it the hard way.
 */
export function sectionTags(src: string): string[] {
  const names = new Set(['Section']);
  for (const imp of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]@urbicon-ui\/docs['"]/g)) {
    for (const spec of imp[1].split(',')) {
      const alias = spec.trim().match(/^Section\s+as\s+([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
    }
  }
  return [...names];
}

/**
 * Sections that do NOT count against the Examples budget.
 *
 * `docs/DocsPageGuide.md` settles one of these and leaves the others open, so
 * they are written down here rather than left to whoever next reads the prose:
 *
 *   - `customization` — rule 5, explicit: "its own scope per XC-4 and not part
 *     of this Examples count".
 *   - `installation` — the import stanza. Every page has exactly one and it is
 *     `preview={false}` reference material, never a use-case.
 *   - `api` / `types` — generated reference, not authored examples.
 *
 * `mint` is deliberately NOT here. Rule 6 says Mint patterns "belong in
 * Examples, not in a separate variant grid", so a page that keeps a standalone
 * Mint section must not buy itself extra budget by doing so — see
 * `countedSections`.
 */
export const UNCOUNTED = new Set(['customization', 'installation', 'api', 'types', 'playground']);

/**
 * Section ids whose `<CodeExample>`s count toward the Examples budget.
 *
 * `examples` plus the Mint section: rule 6 of the guide's Examples Strategy puts
 * Mint patterns in Examples, so counting a Mint section separately would let a
 * page hold nine examples and report four. Button did exactly that until
 * 2026-08 — one example in `examples`, four in `mint` — and read as UNDER
 * budget.
 *
 * The id is matched as `/^mints?$/i` and not as the literal `'mint'`, because
 * the pages do not agree on the spelling: `checkbox` writes `id="mint"` and
 * `segment-group` writes `id="mints"`. The first version of this rule tested
 * the literal, so segment-group's Mint section — 4 examples plus 1, i.e. over
 * budget — was certified clean by the very gate written to catch it. A rule
 * keyed to one spelling of a hand-written id is a rule with a hole in it.
 */
export function isCounted(sectionId: string): boolean {
  return sectionId === 'examples' || /^mints?$/i.test(sectionId);
}

export interface SectionCount {
  id: string;
  examples: number;
}

/**
 * `<CodeExample>` totals per section, in document order.
 *
 * An example is attributed to the last section opened before it. Pages keep
 * their examples in a sibling `Docs.svelte` rendered through `<CustomDocs />`,
 * so the caller must splice that in at its call site first — appending it
 * instead puts every `Docs.svelte` example after the installation section.
 */
export function countBySection(markup: string, tags: readonly string[]): SectionCount[] {
  const clean = blankQuotedMarkup(markup);
  const tagRe = new RegExp(`<(${tags.join('|')})\\b([^>]*)>`, 'g');
  const sections = [...clean.matchAll(tagRe)]
    .map((m) => ({ id: m[2].match(/\bid=["']([^"']+)["']/)?.[1], at: m.index ?? 0 }))
    .filter((s): s is { id: string; at: number } => s.id !== undefined);

  const counts = sections.map((s) => ({ id: s.id, examples: 0 }));
  for (const m of clean.matchAll(/<CodeExample\b/g)) {
    const at = m.index ?? 0;
    let owner = -1;
    for (let i = 0; i < sections.length; i++) {
      if (sections[i].at < at) owner = i;
      else break;
    }
    if (owner >= 0) counts[owner].examples++;
  }
  return counts;
}

/** The budget itself — `docs/DocsPageGuide.md` "2–4 examples per page". */
export const MIN_EXAMPLES = 2;
export const MAX_EXAMPLES = 4;

export type Verdict = 'ok' | 'over' | 'under' | 'missing';

/**
 * A component-specific section carrying more examples than the whole page is
 * allowed — i.e. a second Examples section wearing a different name.
 *
 * The budget started life as a two-value whitelist (`examples` + `mint`), which
 * left every other id silently free. Measured 2026-08 across the 75 component
 * pages: 14 of them held 32 further examples outside the counted set. Most are
 * the deep-dives the Section Order table explicitly allows — one or two demos
 * under `async-search`, `two-factor`, `form-family` — and those stay legitimate.
 * `badge` was not: five numbered demos under `patterns` ("1. Status Tag",
 * "2. Counter — numeric pill", …), one of them a near-verbatim repeat of an
 * entry in its own `examples` section, while the page reported 3 and clean.
 *
 * So the rule is the ceiling, not a name list: a section may be topical, but it
 * may not be bigger than the page's whole example budget. This is also what
 * makes `UNCOUNTED` load-bearing rather than decorative — those ids are
 * reference material and are exempt from the ceiling too.
 */
export function oversizedSections(counts: readonly SectionCount[]): SectionCount[] {
  return counts.filter(
    (c) => !isCounted(c.id) && !UNCOUNTED.has(c.id) && c.examples > MAX_EXAMPLES
  );
}

/** The counted total for a page, and whether it sits inside the budget. */
export function verdictFor(counts: readonly SectionCount[]): {
  total: number;
  counted: SectionCount[];
  oversized: SectionCount[];
  verdict: Verdict;
} {
  const counted = counts.filter((c) => isCounted(c.id));
  const total = counted.reduce((n, c) => n + c.examples, 0);
  const oversized = oversizedSections(counts);
  if (!counts.some((c) => c.id === 'examples'))
    return { total, counted, oversized, verdict: 'missing' };
  if (total > MAX_EXAMPLES) return { total, counted, oversized, verdict: 'over' };
  if (total < MIN_EXAMPLES) return { total, counted, oversized, verdict: 'under' };
  return { total, counted, oversized, verdict: 'ok' };
}
