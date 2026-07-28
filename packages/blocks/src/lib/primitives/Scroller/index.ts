import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { ScrollerSlots, ScrollerVariants } from './scroller.variants';

/**
 * @description Horizontal row of equal-rank items that becomes scrollable only
 * when it runs out of room — an overflow behaviour, not a navigation pattern.
 * On a wide viewport it is an ordinary row: no scrolling, no arrows, no dots,
 * and none of the accessibility duties a scroll container carries. Once it does
 * overflow it snaps to item boundaries, takes a tab stop (`role="group"` +
 * `label`, so the keyboard can scroll it at all — the bug in most media rows),
 * and can show jump buttons and dots. `align="center"` turns it into a centred
 * stage whose middle item lifts via `animation-timeline: view(inline)` — pure
 * CSS, and where that is unsupported the row is identical minus the lift. Use it
 * for feature cards, product rows, media strips and chip/filter bars. It never
 * auto-rotates. For one item at a time with paging semantics use Tab; for
 * page-number navigation use Pagination.
 *
 * @tag layout
 * @tag display
 * @related Tab
 * @related Toolbar
 * @related Pagination
 * @stability experimental
 *
 * @example
 * ```svelte
 * <Scroller label="Main features" itemBasis="18rem">
 *   {#each features as feature (feature.id)}
 *     <FeatureCard {...feature} />
 *   {/each}
 * </Scroller>
 * ```
 *
 * @example
 * ```svelte
 * <!-- Centred stage: three visible, two peeking. Card width is chosen so the
 *      row always overflows — that is what gives it a middle to centre. -->
 * <Scroller label="Main features" itemBasis="22rem" align="center" emphasis indicator="dots">
 *   {#each features as feature (feature.id)}
 *     <FeatureCard {...feature} />
 *   {/each}
 * </Scroller>
 * ```
 */
export interface ScrollerProps
  extends Omit<ScrollerVariants, 'emphasis'>,
    Omit<HTMLAttributes<HTMLDivElement>, 'children' | 'class'> {
  // === Content ===
  /** The row's items. Each direct child becomes one snap target — width, snap alignment and (with `emphasis`) the lift are applied for you. Required. */
  children: Snippet;

  // === Accessibility ===
  /**
   * Accessible name for the row, e.g. "Main features". Required: once the row
   * overflows it becomes a focusable `role="group"`, and an unnamed group is a
   * nameless box to a screen reader. It is deliberately not optional-with-a-
   * fallback — a generic default name would be worse than none.
   */
  label: string;

  // === Variants ===
  /**
   * Where an item comes to rest when the row snaps. `start` is the ordinary
   * overflow row. `center` is a stage: the middle item is the subject, and the
   * track is padded so the first and last item can reach the middle too.
   * @default 'start'
   */
  align?: 'start' | 'center';
  /**
   * Snap strictness. `proximity` snaps when you release nearby and otherwise
   * leaves scrolling alone; `mandatory` always lands on an item and is only
   * right for "exactly one item per screen" — it can otherwise skip past
   * content that sits between two snap points. `none` scrolls freely.
   * @default 'proximity'
   */
  snap?: 'proximity' | 'mandatory' | 'none';
  /** Space between items. @default 'md' */
  gap?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';

  // === Behavior ===
  /**
   * Width of each item, as any CSS length (`'18rem'`, `'clamp(14rem,60vw,22rem)'`).
   * This is what decides when the row overflows, so it is a prop rather than a
   * class: with `align="center"` the component needs it to compute the edge
   * padding. Override per-item layout via `slotClasses.viewport` if you need
   * responsive widths.
   * @default '16rem'
   */
  itemBasis?: string;
  /**
   * Previous/next buttons. `auto` shows them only while the row overflows —
   * on a viewport where everything fits there is nothing to navigate, and
   * controls for a problem that does not exist are just clutter. `always` keeps
   * them mounted (disabled at the ends); `none` omits them.
   * @default 'auto'
   */
  controls?: 'auto' | 'always' | 'none';
  /**
   * Position indicator. `dots` renders one button per item — it both shows how
   * many items there are and jumps to them, marking the current one with
   * `aria-current`. Worth switching on for `align="center"`, where only part of
   * the row is ever visible; leave it off for long chip bars, where a dot per
   * chip is noise.
   * @default 'none'
   */
  indicator?: 'none' | 'dots';
  /**
   * Lift the item in the middle of the scrollport (a small scale + elevation
   * step, scroll-driven via CSS). Only meaningful with `align="center"`.
   * Neighbours are never dimmed or blurred: the point is to mark the middle,
   * not to hide the rest. Respects `prefers-reduced-motion`, and where
   * `animation-timeline` is unsupported it simply does nothing.
   * @default false
   */
  emphasis?: boolean;

  // === Callbacks ===
  /**
   * Fires when the item at the snap anchor changes, with its zero-based index.
   * Intentionally coarse — there is no per-frame scroll-position callback,
   * because the CSS-native carousel primitives this component is meant to be
   * swapped for one day could not honour one.
   */
  onActiveChange?: (index: number) => void;

  // === Labels ===
  /** Accessible label for the previous button. @default 'Previous' (localised) */
  previousLabel?: string;
  /** Accessible label for the next button. @default 'Next' (localised) */
  nextLabel?: string;
  // A dot's label ("Item 3 of 5") takes its position and count from the
  // component, so it is resolved from the `scroller.item` translation key rather
  // than passed in — reword it by overriding that key, not with a prop.

  // === Styling ===
  /** Extra classes merged onto the root container (the column holding the row and its control bar). */
  class?: string;
  /** Remove all default tv() classes; combine with `slotClasses` to rebuild the look. Note that this also strips the layout rules that make the row scroll and snap. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: root (the column —
   * what `class` also targets) | viewport (the scroll container; also where
   * per-item rules like width live, via `[&>*]:…`) | controls (the bar under the
   * row) | control (a previous/next button) | indicator (the dot group) | dot.
   */
  slotClasses?: Partial<Record<ScrollerSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Scroller: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
}

export { default as Scroller } from './Scroller.svelte';
// Only the public-facing types are re-exported; the pure geometry functions in
// `scroller.utils` stay internal (the component and its unit tests import them
// directly from that module) so `export *` in the blocks barrel does not leak
// them into the public API.
export type { ScrollerAlign } from './scroller.utils';
export { type ScrollerVariants, scrollerVariants } from './scroller.variants';
