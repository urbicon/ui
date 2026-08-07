import { getContext, hasContext, setContext } from 'svelte';

/**
 * Automatic section numbering for a documentation page.
 *
 * Every component page used to hand-write its markers — `marker="01"` through
 * `marker="05"` — on 99 pages, 494 literals in 182 files. Three of them were
 * measurably wrong and nothing reported it: `/blocks/primitives/badge` printed
 * `04` twice, `/blocks/components/sparkline` skipped `03`, and
 * `/blocks/primitives/journey-timeline` started at `02`. Inserting one section
 * anywhere meant renumbering every section after it by hand, on every page it
 * appeared on, which is exactly the edit nobody finishes.
 *
 * A gate could have reported those three. Deriving the number instead makes
 * them unrepresentable: a page has one counter, and a section's number is its
 * position in it (see the "a gate is the last resort" note in AGENTS.md).
 *
 * ## What counts
 *
 * A section claims a number only when it asks for one (`marker` without a
 * value) AND it is not nested inside another section. Nesting is read from
 * context, not from the DOM, so a `<TypesReference>` inside a playground stage
 * stays unnumbered while the same component at page level is numbered — no
 * caller has to know the difference.
 *
 * ## Ordering
 *
 * Numbers are handed out in component-initialisation order, which for the
 * static markup of a docs page is its render order — the same on the server and
 * in the browser, so the number never changes under hydration. A section
 * revealed later by an `{#if}` would claim its number when it first renders,
 * i.e. at the end; no docs page does that today, and the alternative (sorting
 * by `compareDocumentPosition` in an effect) cannot run during SSR and would
 * flash a numberless heading.
 */
export interface SectionNumbering {
  /**
   * Claims this page's next number for `key`, or returns the one already held.
   * Idempotent per key, so re-running the derivation cannot advance the
   * counter.
   */
  claim(key: string): number;
}

/**
 * Module-private symbols rather than `createContext()`, which the repo
 * otherwise requires (see SVELTE5-PATTERNS.md): both of these questions are
 * about ABSENCE — "is there a page counter?", "does a section enclose me?" —
 * and `createContext`'s getter throws when no parent has set the context. A
 * symbol pairs with `hasContext()`, which answers absence without a throw, and
 * carries the two properties the rule exists for anyway: it cannot collide with
 * another module's key, and the accessors below are typed.
 */
const NUMBERING = Symbol('docs.section-numbering');
const INSIDE_SECTION = Symbol('docs.inside-section');

/**
 * Starts a numbering scope. `DocsLayout` calls this, so every page it wraps
 * numbers independently and a page without one simply renders no markers.
 */
export function createSectionNumbering(): SectionNumbering {
  const claimed = new Map<string, number>();

  const numbering: SectionNumbering = {
    claim(key: string) {
      const existing = claimed.get(key);
      if (existing !== undefined) return existing;
      const next = claimed.size + 1;
      claimed.set(key, next);
      return next;
    }
  };

  setContext(NUMBERING, numbering);
  return numbering;
}

/** The page's numbering, or `undefined` outside a `DocsLayout`. */
export function useSectionNumbering(): SectionNumbering | undefined {
  return hasContext(NUMBERING) ? getContext<SectionNumbering>(NUMBERING) : undefined;
}

/** Marks the subtree as being inside a section. `Section` calls this. */
export function markInsideSection(): void {
  setContext(INSIDE_SECTION, true);
}

/** True when a `<Section>` encloses this one. */
export function isInsideSection(): boolean {
  return hasContext(INSIDE_SECTION);
}
