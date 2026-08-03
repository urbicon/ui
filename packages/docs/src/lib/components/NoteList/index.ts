import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type {
  NoteListSlots,
  NoteListVariantProps,
  NoteSlots,
  NoteVariantProps
} from './notelist.variants';

/**
 * Props interface for NoteList component
 *
 * @summary Card of short titled notes separated by rules — the accessibility block of a docs page.
 * @description Wraps a series of `Note` rows in the standard documentation card.
 * Row separators and the first/last row padding are handled by the component, so
 * adding or reordering a note never means fixing the spacing of its neighbours.
 *
 * @tag display
 * @tag documentation
 * @related Note
 * @related InfoCard
 * @related Section
 *
 * @example
 * ```svelte
 * <NoteList>
 *   <Note title="Built-in ARIA">The trigger carries `aria-expanded`.</Note>
 *   <Note title="Keyboard">Arrow keys move between items, Escape closes.</Note>
 * </NoteList>
 * ```
 */
export interface NoteListProps
  extends NoteListVariantProps,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /**
   * The `Note` rows. Anything else renders too, but loses the row padding the
   * separators are calibrated against.
   */
  children?: Snippet;

  // === STYLING ===
  /** Extra classes merged onto the root element. */
  class?: string;

  /** Strip all default styles; combine with `slotClasses` to rebuild from scratch. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<NoteListSlots, string>>;
}

/**
 * Props interface for Note component
 *
 * @summary One titled note inside a NoteList — a heading and a short paragraph of prose.
 * @description A row of a `NoteList`. The prose tokens sit on the row itself, so
 * the body can be bare text, a paragraph or a list without the component
 * choosing a block element on the author's behalf.
 *
 * @tag display
 * @tag documentation
 * @related NoteList
 *
 * @example
 * ```svelte
 * <Note title="Reduced motion">The slide is dropped under `prefers-reduced-motion`.</Note>
 * ```
 */
export interface NoteProps extends NoteVariantProps, Omit<HTMLAttributes<HTMLElement>, 'title'> {
  /**
   * The note's heading. Renders as an `<h4>` — deliberately not the native
   * `title` tooltip attribute, which is why it is omitted from the inherited
   * `HTMLAttributes`.
   */
  title?: string;

  /**
   * Heading content when the title carries markup — a `<code>` sample in the
   * heading is common enough on these pages that a plain string would push
   * authors back to hand-written markup. Wins over `title` when both are set.
   */
  titleSnippet?: Snippet;

  /**
   * Heading level for the note title, clamped to 1..6. A note sits under a
   * `<Section>` heading (`h2` by default) and is a sibling of the other titled
   * sub-blocks on the page — a `CodeExample` title renders `h3` — so `h3` is
   * the default.
   *
   * It was `h4` until 2026-08, inherited from the hand-written markup this
   * component replaced. That produced `h2 → h4` on all 59 pages carrying an
   * accessibility card, while every other sub-block on the same page was `h3`:
   * a heading skip, and an inconsistent one. The title styling is class-driven,
   * so correcting the level changed nothing visually.
   * @default 3
   */
  headingLevel?: 1 | 2 | 3 | 4 | 5 | 6;

  /** The note body. */
  children?: Snippet;

  // === STYLING ===
  /** Extra classes merged onto the root element. */
  class?: string;

  /** Strip all default styles; combine with `slotClasses` to rebuild from scratch. */
  unstyled?: boolean;

  /** Per-slot class overrides for internal elements. */
  slotClasses?: Partial<Record<NoteSlots, string>>;
}

export { default as Note } from './Note.svelte';
// Export the components
export { default } from './NoteList.svelte';
// Export variants
export {
  type NoteListSlots,
  type NoteListVariantProps,
  type NoteSlots,
  type NoteVariantProps,
  noteListVariants,
  noteVariants
} from './notelist.variants';
