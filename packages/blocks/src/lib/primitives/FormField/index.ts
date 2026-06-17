import type { Snippet } from 'svelte';
import type { HTMLAttributes } from 'svelte/elements';

/**
 * @description Layout wrapper for composite form fields that need a label,
 * helper text, and error message but cannot rely on the built-in slots of
 * primitives like {@link InputProps} or {@link SelectProps}. Examples:
 * a custom file picker, a slider/number-input pair, a media uploader.
 *
 * The `id` is auto-generated and forwarded to the slot via the `for`
 * snippet parameter so the rendered control can wire `aria-describedby`
 * and `aria-invalid` correctly.
 *
 * @tag form
 * @related Input
 * @related Select
 * @related Textarea
 *
 * @example
 * ```svelte
 * <FormField label="Document" required error={fileError} hint="PDF, JPG, PNG — max 10 MB">
 *   {#snippet children({ id, describedBy, invalid })}
 *     <FileUpload {id} aria-describedby={describedBy} aria-invalid={invalid} bind:files />
 *   {/snippet}
 * </FormField>
 * ```
 */
export interface FormFieldProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Label rendered above the control. Auto-linked to the slot via the generated `id`. */
  label?: string;

  /** Helper text shown below the control. Hidden when `error` is present. */
  hint?: string;

  /**
   * Error message shown below the control. Replaces the helper text and
   * propagates `invalid: true` to the slot for ARIA wiring.
   */
  error?: string;

  /**
   * Adds a required asterisk to the label and propagates `required: true`
   * to the slot. Does **not** apply the native `required` attribute —
   * the slot's control is responsible for that.
   * @default false
   */
  required?: boolean;

  /** Disables visual emphasis. Pass through to the slot's control as needed. @default false */
  disabled?: boolean;

  /**
   * Explicit HTML `id` for the control. Auto-generated when omitted, then
   * forwarded to the slot. Caller may use it to attach external `<label for>`.
   */
  id?: string;

  /**
   * Extra classes merged onto the wrapper element.
   */
  class?: string;

  /**
   * Per-slot class overrides.
   */
  slotClasses?: Partial<Record<'wrapper' | 'label' | 'message' | 'hint', string>>;

  /**
   * Snippet receiving wiring metadata (`id`, `describedBy`, `invalid`,
   * `required`, `disabled`). The wrapped control should spread or apply
   * these to itself for accessibility.
   */
  children: Snippet<[FormFieldSlotContext]>;
}

/** Wiring metadata passed to the {@link FormFieldProps.children} snippet. */
export interface FormFieldSlotContext {
  /** Auto-generated or caller-provided HTML id. Set on the control. */
  id: string;
  /** Space-separated list of message ids; assign to `aria-describedby`. */
  describedBy: string | undefined;
  /** Whether the field is in an error state. Assign to `aria-invalid`. */
  invalid: boolean;
  /** Mirrors {@link FormFieldProps.required}. */
  required: boolean;
  /** Mirrors {@link FormFieldProps.disabled}. */
  disabled: boolean;
}

export { default as FormField } from './FormField.svelte';
