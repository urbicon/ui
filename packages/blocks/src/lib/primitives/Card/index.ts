import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { CardVariants } from './card.variants';

/**
 * @description Flexible container for grouping related content with optional header, footer,
 * and interactive states. Renders as div, button, or anchor depending on the provided props.
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
   */
  clickable?: boolean;

  /** Extra classes merged onto the root element. */
  class?: string;
  /** Remove all default tv classes. */
  unstyled?: boolean;
  /** Per-slot class overrides. */
  slotClasses?: Partial<Record<'base' | 'header' | 'content' | 'footer', string>>;
  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Card: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;
  /** Micro-interaction preset. Only takes effect on interactive cards. */
  mint?: MintProp;
}

export { default as Card } from './Card.svelte';
export { type CardVariants, cardVariants } from './card.variants';
