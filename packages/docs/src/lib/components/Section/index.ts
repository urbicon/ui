import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SectionSlots, SectionVariantProps } from './section.variants';

/**
 * Props interface for Section component
 *
 * @summary Anchored content section with an editorial marker, title, subtitle and badges.
 * @description Content section with title/subtitle, badges, and semantic footer.
 *
 * @tag layout
 * @tag display
 * @related InfoCard
 *
 * @example
 * ```svelte
 * <Section id="usage" title="Usage" subtitle="Quick start">
 *   <p>Install and import the component.</p>
 * </Section>
 * ```
 */
export interface SectionProps
  extends SectionVariantProps,
    Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  /**
   * Section ID for navigation anchors
   */
  id: string;

  /**
   * Title text. Renders as the section heading — this is deliberately **not**
   * the native `title` tooltip attribute, which is why it is omitted from the
   * inherited `HTMLAttributes`.
   */
  title?: string;

  /**
   * Editorial marker before the title — a quieter monospace stamp.
   *
   * Pass it bare (`<Section marker …>`) and the page numbers the section for
   * you: sections that ask for a marker are counted in render order within the
   * enclosing `DocsLayout`, so inserting one renumbers the rest by itself.
   * A section nested inside another never claims a number, which is what keeps
   * a `<TypesReference>` inside a playground stage unnumbered while the same
   * component at page level is numbered.
   *
   * A string still wins, for the rare page that numbers by hand. Prefer the
   * bare form: the hand-written literals were wrong on four pages
   * (a duplicate `04`, two skipped numbers, one page starting at `02`) and
   * nothing reported it.
   */
  marker?: string | boolean;

  /**
   * Optional right-aligned monospace meta information in the title row
   * (e.g. `"20 props"`, `"6 recipes"`). Renders as an editorial counter
   * next to the title with `font-meta`, so the information stays visually
   * subordinate to the section title.
   */
  meta?: string;

  /**
   * Keep the header in the screen-reader layer only — the section still gets a
   * real heading and a working `aria-labelledby`, it just does not draw one.
   *
   * For sections whose purpose is obvious from what they contain but that carry
   * no heading in the design. The component playgrounds are the case this
   * exists for: the specimen sits directly under the page `h1` and a
   * "Playground" heading above it would be redundant to a sighted reader —
   * while without one the table of contents offered a "Playground" entry
   * leading into an unnamed region, and heading navigation skipped the largest
   * interactive element on the page (measured on 57 pages, 2026-08).
   *
   * Do not reach for it to quiet a section that simply has no title yet: a
   * hidden heading and a missing heading look the same in the markup and only
   * one of them is a decision.
   * @default false
   */
  titleHidden?: boolean;

  /**
   * Subtitle text (property)
   */
  subtitle?: string;

  /**
   * Badge configuration
   */
  badges?: Array<{
    text: string;
    variant?: 'soft' | 'filled';
    intent?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  }>;

  /**
   * Heading level for the section title, clamped to 1..6
   * @default 2
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  // === STYLING ===
  /** Extra classes merged onto the root element. */
  class?: string;

  /** Strip all default styles; combine with `slotClasses` to rebuild from scratch. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<SectionSlots, string>>;

  // === SNIPPETS ===
  /**
   * Custom title snippet (overrides title prop)
   */
  titleSnippet?: Snippet;

  /**
   * Custom subtitle snippet (overrides subtitle prop)
   */
  subtitleSnippet?: Snippet;

  /**
   * Main content snippet
   */
  children?: Snippet;

  /**
   * Optional footer snippet (renders a semantic <footer>)
   */
  footerSnippet?: Snippet;
}

// Export Section component
export { default as Section } from './Section.svelte';
// Export variants
export {
  type SectionSlots,
  type SectionVariantProps,
  sectionVariants
} from './section.variants';
