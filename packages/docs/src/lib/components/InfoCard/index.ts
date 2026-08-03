import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { InfoCardSlots, InfoCardVariantProps } from './infocard.variants';

/**
 * Props interface for InfoCard component
 *
 * @summary Inline callout for notes, tips and warnings inside documentation prose.
 * @description Simple memo-style card for inline callouts or notes within docs content.
 *
 * @tag display
 * @tag feedback
 * @related Section
 *
 * @example
 * ```svelte
 * <InfoCard title="Tip" icon="lightbulb">Use variants to change tone.</InfoCard>
 * ```
 */
export interface InfoCardProps
  extends InfoCardVariantProps,
    Omit<HTMLAttributes<HTMLElement>, 'children' | 'title'> {
  /**
   * Heading shown above the body. Also becomes the card's accessible name
   * (`aria-label`), so it is deliberately not the native `title` tooltip.
   */
  title?: string;

  /**
   * Heading level for the card title, clamped to 1..6. Cards usually sit inside
   * a `<Section>` (`h2`), so `h3` is the default.
   *
   * It was a fixed `h4` until 2026-08, which put an `h2 → h4` skip into the
   * outline of every page that used a card directly under a section, and an
   * `h1 → h4` one on the pages that use cards as their landing grid. Pass an
   * explicit level where the nesting differs. The title styling is class-driven,
   * so the level never changes how the card looks.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  /**
   * Decorative glyph rendered before the title. Purely visual — it is hidden
   * from assistive tech, so never put meaning here that the title does not carry.
   */
  icon?: string;

  /**
   * Render the card as a link to this URL. Falls back to an `<aside>` when omitted.
   */
  href?: string;

  /** Card body. */
  children?: Snippet;

  // === STYLING ===
  /** Extra classes merged onto the root element. */
  class?: string;

  /** Strip all default styles; combine with `slotClasses` to rebuild from scratch. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<InfoCardSlots, string>>;
}

// Export the component
export { default } from './InfoCard.svelte';
// Export variants
export {
  type InfoCardSlots,
  type InfoCardVariantProps,
  infoCardVariants
} from './infocard.variants';
