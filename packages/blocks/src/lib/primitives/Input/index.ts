import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InputSlots, InputVariants } from './input.variants';

/**
 * @summary The single-line text field, with label, validation and icons.
 * @description Text input with labels, validation states, icons, and clearable functionality.
 * Supports outlined, filled, and ghost visual variants with automatic ARIA linking.
 *
 * @tag form
 * @related Textarea
 * @related Select
 * @related Combobox
 *
 * @example
 * ```svelte
 * <Input label="Email" placeholder="name@example.com" required />
 * ```
 */
export interface InputProps
  extends Omit<InputVariants, 'error'>,
    Omit<HTMLInputAttributes, 'size' | 'class' | 'disabled' | 'readonly' | 'children'> {
  /** Snippet content rendered below the input for advanced layouts. */
  children?: Snippet;

  /** Label text displayed above the input, auto-linked via `for`/`id`. */
  label?: string;
  /**
   * Error message below the input. When set, overrides `helper` and
   * forces danger border styling regardless of `intent`.
   */
  error?: string;
  /** Helper text below the input — hidden when `error` is present. */
  helper?: string;

  /** Icon snippet rendered on the left side of the input field. */
  leftIcon?: Snippet;
  /** Icon snippet rendered on the right side of the input field. */
  rightIcon?: Snippet;
  /** When provided, the left icon becomes a clickable button. */
  onLeftIconClick?: () => void;
  /** When provided, the right icon becomes a clickable button. */
  onRightIconClick?: () => void;
  /**
   * Accessible label for the clickable left icon button. Required when
   * `onLeftIconClick` is set so screen-reader users hear a name for the
   * button (icons inside are `aria-hidden`).
   */
  leftIconAriaLabel?: string;
  /**
   * Accessible label for the clickable right icon button. Required when
   * `onRightIconClick` is set so screen-reader users hear a name for the
   * button (icons inside are `aria-hidden`).
   */
  rightIconAriaLabel?: string;

  /**
   * Show a clear button when the input has a value.
   * Press Escape or click the button to clear. Fires `onClear` after clearing.
   * @default false
   * @summary Show a clear button once the field has a value.
   */
  clearable?: boolean;
  /** Fired after the value is cleared via the clear button or Escape key. */
  onClear?: () => void;

  /** @default false */
  disabled?: boolean;
  /** @default false */
  readonly?: boolean;
  /** Adds a required asterisk to the label and sets the native `required` attribute. @default false */
  required?: boolean;

  /** Micro-interaction preset applied to the input element. @default 'none' */
  mint?: MintProp;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (root —
   * what `class` also targets) | container | base (the `<input>` element) |
   * label | message | iconContainer | iconButton | iconDecoration.
   */
  slotClasses?: Partial<Record<InputSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Input: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** HTML autocomplete hint for browser autofill. */
  autoComplete?: string;

  /** Key for persisting the input value to storage. */
  persistKey?: string;
  /** Storage backend for persistence. @default 'localStorage' */
  persistStorage?: 'localStorage' | 'sessionStorage';
  /** Debounce interval (ms) for storage writes. @default 300 */
  persistDebounceMs?: number;
  /** Version stamp included in the storage key. @default 1 */
  persistVersion?: number;
  /** Namespace (e.g. user id) to scope the persist key. */
  persistNamespace?: string;
}

export { default as Input } from './Input.svelte';
export { type InputVariants, inputVariants } from './input.variants';
