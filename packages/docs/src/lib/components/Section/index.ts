import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { SectionSlots, SectionVariantProps } from './section.variants';

/**
 * Props interface for Section component
 *
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
   * Optional editorial marker before the title (e.g. `"01"` renders as a
   * quieter monospace stamp).
   */
  marker?: string;

  /**
   * Optional right-aligned monospace meta information in the title row
   * (e.g. `"20 props"`, `"6 recipes"`). Renders as an editorial counter
   * next to the title with `font-meta`, so the information stays visually
   * subordinate to the section title.
   */
  meta?: string;

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
