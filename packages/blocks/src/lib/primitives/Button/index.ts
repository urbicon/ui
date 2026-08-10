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

  /** Remove default tailwind-variants classes. Only user classes apply. */
  unstyled?: boolean;
  /** Per-slot class overrides merged with tv styles. Slots: base | content | spinner */
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
   * @default 'scale'
   * @summary Decorative feedback effect on the button — held on hover, or a one-shot on click.
   */
  mint?: MintProp;
}

export { default as Button } from './Button.svelte';
// Export variants and component
export { type ButtonVariants, buttonVariants } from './button.variants';
