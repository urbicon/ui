import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { CardSlots, CardVariants } from './card.variants';

/**
 * @summary A container that groups what belongs together, clickable where it should be.
 * @description Flexible container for grouping related content with optional header, footer,
 * and interactive states. Renders as div, button, or anchor depending on the provided props.
 *
 * Shape follows the container tier (`--radius-contain`), so retuning that token moves every
 * Card along with Dialog, Alert and Popover. `tier="bridge"` is the one sanctioned deviation
 * and it is optical, not decorative: radius scales with the area it turns, so the hairline
 * edge that reads as precise on a wide panel reads as an untouched rectangle on a small
 * tinted tile. Reach for it when a Card is a content chip rather than architecture — and not
 * to give one card a different look, which splits the family (see the `variant` axis for
 * weight, and `BlocksProvider` `defaults` for a project-wide Card treatment).
 *
 * @tag layout
 * @related Accordion
 * @related Collapsible
 *
 * @example
 * ```svelte
 * <Card padding="lg">
 *   {#snippet header()}
 *     <h3>Title</h3>
 *   {/snippet}
 *   <p>Body content</p>
 * </Card>
 * ```
 *
 * @example
 * ```svelte
 * <Card variant="elevated" dividers onclick={() => navigate('/detail')}>
 *   {#snippet header()}
 *     <div class="flex items-center gap-3">
 *       <Avatar name="Jane Doe" size="sm" />
 *       <span class="font-medium">Jane Doe</span>
 *     </div>
 *   {/snippet}
 *   <p>Interactive card that navigates on click.</p>
 *   {#snippet footer()}
 *     <span class="text-text-tertiary text-sm">2 min ago</span>
 *   {/snippet}
 * </Card>
 * ```
 */
export interface CardProps
  extends Omit<CardVariants, 'elementType' | 'interactive'>,
    Omit<HTMLAttributes<HTMLElement>, 'children'> {
  /** Main body content. */
  children?: Snippet;
  /** Content rendered above the body. With `dividers`, a hairline separates header from body. */
  header?: Snippet;
  /** Content rendered below the body. With `dividers`, a hairline separates body from footer. */
  footer?: Snippet;

  /** Click handler. When provided, the card renders as `<button>` and gains interactive styles. */
  onclick?: (event: MouseEvent) => void;
  /** Called when hover state changes. Receives `true` on mouse-enter, `false` on mouse-leave. */
  onHover?: (hovered: boolean) => void;
  /** URL target. When provided, the card renders as `<a>`. */
  href?: string;
  /**
   * Force `<button>` rendering and interactive hover styles without
   * providing an `onclick` handler — useful when delegating clicks
   * through a wrapper component or library. `onclick` and `href`
   * already enable interactive styles automatically; reach for
   * `clickable` only when neither is appropriate.
   *
   * Don't combine with an outer `<a href>` or inner interactive
   * content — `<a><Card clickable>…</Card></a>` produces nested
   * interactive elements (invalid HTML, a11y violation). Prefer
   * `<Card href={…}>` so the card itself becomes the anchor.
   * @summary Makes the whole card a button, even without an `onclick`.
   */
  clickable?: boolean;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. Slots: base | header | content | footer */
  slotClasses?: Partial<Record<CardSlots, string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Card: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   *
   * A conditional `overrides` rule on a Card keys on its variant axes, and one
   * of those is not a prop: `interactive` is the axis `clickable`, `onclick`
   * and `href` all resolve to, so `overrides: [{ interactive: true, … }]`
   * styles every card that has a click source, whichever of the three gave it
   * one. It is deliberately not settable — a card made to look interactive
   * without one would be a `<div>` with `cursor-pointer` and a hover-lift and
   * no way to operate it (WCAG 3.2 Predictable).
   */
  preset?: string;
  /**
   * Micro-interaction preset applied to the card. Only applies while the
   * card is interactive (`clickable`, `onclick`, or `href`) and not disabled.
   * @default 'none'
   */
  mint?: MintProp;
}

export { default as Card } from './Card.svelte';
export { type CardVariants, cardVariants } from './card.variants';
