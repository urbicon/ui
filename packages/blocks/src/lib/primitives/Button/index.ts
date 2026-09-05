import type { Snippet } from 'svelte';
import type { HTMLButtonAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { ButtonSlots, ButtonVariants } from './button.variants';

/**
 * Props interface for Button component
 *
 * @summary The control that commits an action, in every weight an interface needs.
 * @description Versatile button component with multiple variants, sizes, intents, and micro-interaction patterns.
 * Built with Svelte 5 and optimized for performance and accessibility.
 *
 * @tag action
 * @related ButtonGroup
 * @related Toolbar
 *
 * @example
 * ```svelte
 * <Button variant="filled" intent="primary" size="md">
 *   Click me
 * </Button>
 * ```
 *
 * @example
 * ```svelte
 * <Button variant="outlined" intent="danger" mint={['shake', 'ripple']}>
 *   Delete Item
 * </Button>
 * ```
 *
 * @example Using a project-defined preset (recommended over `class="bg-…!"` overrides)
 * ```svelte
 * <!-- Register once at app root: -->
 * <BlocksProvider
 *   presets={{
 *     Button: {
 *       overlay: {
 *         slotClasses: {
 *           base: 'bg-black/20 hover:bg-black/30 active:bg-black/40 text-white border-transparent'
 *         }
 *       }
 *     }
 *   }}
 * >
 *   <Button preset="overlay">Reinholen</Button>
 * </BlocksProvider>
 * ```
 */
export interface ButtonProps extends ButtonVariants, Omit<HTMLButtonAttributes, 'children'> {
  // === CORE PROPS ===
  /**
   * The content of the button
   */
  children?: Snippet;

  /**
   * The value associated with the button (useful in ButtonGroups)
   * @see HTMLButtonAttributes.value
   */
  value?: string;

  // === BEHAVIORAL PROPS ===
  /**
   * Whether the button is in a loading state
   * @default false
   */
  loading?: boolean;

  /**
   * Where the loading indicator should appear when loading is true
   * - 'overlay': spinner overlays content and hides it (default)
   * - 'start': spinner appears before the content
   * - 'end': spinner appears after the content
   * @default 'overlay'
   * @summary Where the spinner sits while loading — over the label, before it, or after it.
   */
  loadingPlacement?: 'overlay' | 'start' | 'end';

  /**
   * Whether the button is pressed (for toggle buttons)
   * @default false
   */
  pressed?: boolean;

  /**
   * Whether the button is visually active/selected (e.g. in a ButtonGroup with selection).
   * Unlike `pressed` (momentary feedback), `active` represents a persistent selected state.
   * @default false
   */
  active?: boolean;

  /**
   * Whether the button is disabled
   * @see HTMLButtonAttributes.disabled
   * @default false
   */
  disabled?: boolean;

  // === INTERACTIVE PROPS ===
  /**
   * Click handler
   */
  onclick?: (event: MouseEvent) => void;

  // === Styling ===

  /**
   * Custom CSS class name
   * @see HTMLButtonAttributes.class
   */
  class?: string;

  /** Remove the default variant classes. Only user classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv styles. Slots: base | content | spinner.
   * A button never shrinks below its label and never clips it; to truncate a
   * long label instead, let the button shrink (`class="min-w-0"`) and wrap the
   * label in a block that clips it: `<span class="block truncate">…</span>`.
   * Not `slotClasses={{ content: 'truncate' }}` — the content slot is a flex
   * row, and `text-overflow` paints its ellipsis only on a block container.
   */
  slotClasses?: Partial<Record<ButtonSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Button: {...} }}>`.
   * Prefer this over `class="bg-…!"` overrides when the requested look is outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent and
   * make the custom look reusable across the project.
   */
  preset?: string;

  /**
   * Micro-interaction preset applied to the button. Only applies while the
   * button is neither disabled nor loading. Inside a ButtonGroup, the
   * group's `mint` always wins over this prop.
   *
   * `mint="none"` also flattens the press sink — the dip under a held pointer —
   * leaving a button that reacts in colour and depth but never moves. Every
   * ButtonGroup renders its children that way by default (its own `mint`
   * defaults to `'none'` and wins over this prop), which is what keeps a
   * connected group's shared seam still on click; it is also what a large or
   * full-width trigger row wants, where the dip reads as a wobble.
   * @default 'scale'
   * @summary Decorative feedback effect on the button — held on hover, or a one-shot on click.
   */
  mint?: MintProp;
}

export { default as Button } from './Button.svelte';
// Export variants and component
export { type ButtonVariants, buttonVariants } from './button.variants';
