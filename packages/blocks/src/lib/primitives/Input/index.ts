import type { Snippet } from 'svelte';
import type { HTMLInputAttributes } from 'svelte/elements';
import type { MintProp } from '#lib/mint/index.js';
import type { InputSlots, InputVariants } from './input.variants';

/**
 * @summary The single-line text field, with label, validation and icons.
 * @description Text input with labels, validation states, icons, and clearable functionality.
 * Supports the outlined, filled, ghost, underline and bare visual variants, with
 * automatic ARIA linking.
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
  // Axes Input computes rather than receives. The `error` axis is the boolean
  // of the `error` message declared below and `messageType` follows from it;
  // `hasLeftIcon` / `hasRightIcon` follow from the icon snippets and the clear
  // button, `iconPosition` is set per icon container. A prop named after one of
  // the last four is never read — it lands on the `<input>` as an unknown
  // attribute — so the type leaves them out instead of accepting a no-op.
  extends Omit<
      InputVariants,
      'error' | 'messageType' | 'hasLeftIcon' | 'hasRightIcon' | 'iconPosition'
    >,
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

  /**
   * Micro-interaction preset applied to the input element. Only applies
   * while not disabled.
   * @default 'none'
   */
  mint?: MintProp;

  /** Extra classes merged onto the root wrapper element. */
  class?: string;
  /** Remove all default tv() classes — only user-provided classes apply. */
  unstyled?: boolean;
  /**
   * Per-slot class overrides merged with tv() styles. Slots: wrapper (root —
   * what `class` also targets) | container | base (the `<input>` element) |
   * label | requiredMark | message | iconContainer | iconButton | iconDecoration.
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

  /**
   * Key for persisting the input value to storage. When the field starts
   * persisting — at mount, or when this key first arrives later — a stored
   * value wins over the field's text whenever one exists, an empty one too, so
   * a field the user cleared comes back cleared after a reload. While nothing
   * is stored, the field's text at that point (at mount, the `value` it mounts
   * with) is the starting text and is written to storage; an empty field
   * writes nothing until it is edited. A `value` changed while persisting
   * replaces the text and is stored. Moving to another entry at runtime — a
   * changed key, `persistNamespace` or `persistVersion` — restores what that
   * entry holds, and an empty entry stays empty until the next edit: the text
   * on screen is not carried into it. On `type="number"` and `type="range"` a
   * restored entry reaches `bind:value` as a number, `null` when empty.
   */
  persistKey?: string;
  /** Storage backend for persistence. @default 'localStorage' */
  persistStorage?: 'localStorage' | 'sessionStorage';
  /** Debounce interval (ms) for storage writes. @default 300 */
  persistDebounceMs?: number;
  /**
   * Version stamp included in the storage key. Raising it deletes this key's
   * entries under every lower version when the field starts persisting under
   * it — nothing is carried over, so the stored text is lost by design.
   * @default 1
   */
  persistVersion?: number;
  /** Namespace (e.g. user id) to scope the persist key. */
  persistNamespace?: string;
}

export { default as Input } from './Input.svelte';
export { type InputVariants, inputVariants } from './input.variants';
