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
 * `examples` plus `mint`: rule 6 of the guide's Examples Strategy puts Mint
 * patterns in Examples, so counting a `mint` section separately would let a page
 * hold nine examples and report four. Button did exactly that until 2026-08 —
 * one example in `examples`, four in `mint` — and read as UNDER budget.
 */
export function isCounted(sectionId: string): boolean {
  return sectionId === 'examples' || sectionId === 'mint';
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

/** The counted total for a page, and whether it sits inside the budget. */
export function verdictFor(counts: readonly SectionCount[]): {
  total: number;
  counted: SectionCount[];
  verdict: Verdict;
} {
  const counted = counts.filter((c) => isCounted(c.id));
  const total = counted.reduce((n, c) => n + c.examples, 0);
  if (!counts.some((c) => c.id === 'examples')) return { total, counted, verdict: 'missing' };
  if (total > MAX_EXAMPLES) return { total, counted, verdict: 'over' };
  if (total < MIN_EXAMPLES) return { total, counted, verdict: 'under' };
  return { total, counted, verdict: 'ok' };
}
