import type { HTMLInputAttributes } from 'svelte/elements';
import type { MintProp } from '$lib/mint';
import type { InteractiveTier } from '$lib/utils';
import type { CheckboxSlots, CheckboxVariants } from './checkbox.variants';

/**
 * @description Accessible checkbox with indeterminate support, semantic intents, and form integration.
 * Uses a hidden native input for correct form behavior and ARIA semantics.
 *
 * @tag form
 * @related Toggle
 * @related RadioGroup
 *
 * @example
 * ```svelte
 * <Checkbox label="Accept terms" bind:checked />
 * ```
 *
 * @example
 * ```svelte
 * <Checkbox
 *   label="Select all"
 *   indeterminate
 *   onCheckedChange={(val) => console.log(val)}
 * />
 * ```
 */
export interface CheckboxProps
  extends Omit<CheckboxVariants, 'error' | 'checked' | 'indeterminate'>,
    Omit<HTMLInputAttributes, 'type' | 'size' | 'checked' | 'class' | 'children'> {
  /** Current checked state. Supports two-way binding via `bind:checked`. */
  checked?: boolean;

  /** Visual-only third state showing a dash icon. Resets to unchecked on next user toggle. Does not affect the submitted form value. Supports `bind:indeterminate`. */
  indeterminate?: boolean;

  /** Text label displayed to the right of the checkbox box. */
  label?: string;

  /** Hint text shown below the control. Hidden when `error` is set. */
  helper?: string;

  /** Error message that replaces `helper`, styles the message red, and sets `aria-invalid` on the input. */
  error?: string;

  /** Prevent interaction and dim the control. */
  disabled?: boolean;

  /** Mark the native input as required for form validation. */
  required?: boolean;

  /** The `name` attribute of the underlying `<input>`. Used for form submission. */
  name?: string;

  /** The value submitted when checked. Defaults to `'on'`. */
  value?: string;

  /** Extra classes merged onto the wrapper element. */
  class?: string;

  /** Strip all default tailwind-variants classes. Use with `slotClasses` for a fully custom look. The box exposes `data-state` for conditional styling. */
  unstyled?: boolean;

  /**
   * Per-slot class overrides merged with (or replacing, when `unstyled`) the
   * default styles. Slots: wrapper (root — what `class` also targets) | control |
   * box | icon | label | message.
   */
  slotClasses?: Partial<Record<CheckboxSlots, string>>;

  /**
   * Apply a named preset registered via `<BlocksProvider presets={{ Checkbox: {...} }}>`.
   * Prefer this over `class` overrides when the requested look falls outside the
   * semantic intent palette — presets keep hover/active/dark-mode logic coherent
   * and make the custom look reusable across the project.
   */
  preset?: string;

  /** Micro-interaction preset applied to the control area on hover/click. */
  mint?: MintProp;

  /** Fired after the checked state changes. Receives the new `checked` value. */
  onCheckedChange?: (checked: boolean) => void;

  /** Explicit `id` to link `<label>` and `<input>`. Auto-generated if omitted. */
  id?: string;

  /**
   * Semantic radius tier. Default `modify` — checkbox is an input-tap
   * surface. Inherited from TierContext when omitted; falls back to
   * `modify` outside of any tier-aware container.
   */
  tier?: InteractiveTier;
}

export { default as Checkbox } from './Checkbox.svelte';
export { type CheckboxVariants, checkboxVariants } from './checkbox.variants';
