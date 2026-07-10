/**
 * `useFormField` — Single source of truth for the ARIA wiring that every
 * Form primitive duplicates: error/helper id derivation, `aria-describedby`,
 * `aria-invalid`, and the mutually-exclusive error-over-helper convention.
 *
 * Layout (label position, error/helper placement, required marker) stays
 * component-specific because real Form primitives differ in shape — Input
 * stacks the label on top, Checkbox/Toggle put it inline, RadioGroup and
 * SegmentGroup have a group caption + per-item labels. The hook does not
 * touch markup; it just exposes the IDs and the `invalid` boolean.
 *
 * **`fieldId` must be supplied by the caller** because Svelte's
 * `$props.id()` rune is only valid at component top-level — the caller
 * computes it once with `$props.id()` and threads it through here. That
 * keeps the hook itself usable from any context (test runs, non-Svelte
 * code, future refactors) without inheriting the rune placement rules.
 *
 * The pure `computeFormFieldAria` helper carries the logic and is
 * directly unit-tested. `useFormField` is a one-line reactive wrapper
 * around it that re-evaluates on every prop change via `$derived`.
 *
 * @example
 * ```svelte
 * <script lang="ts">
 *   import { useFormField } from '$lib/utils';
 *   let { id: idProp, helper, error, required, disabled, label } = $props();
 *   const propsId = $props.id();
 *   const ff = useFormField(() => ({
 *     fieldId: idProp ?? `field-${propsId}`,
 *     helper,
 *     error,
 *     required,
 *     disabled
 *   }));
 * </script>
 *
 * <label for={ff.fieldId}>{label}</label>
 * <input
 *   id={ff.fieldId}
 *   aria-describedby={ff.describedBy}
 *   aria-invalid={ff.invalid || undefined}
 * />
 * {#if ff.errorId}<div id={ff.errorId} role="alert">{error}</div>{/if}
 * ```
 */

export interface UseFormFieldInputs {
  /** The DOM id to apply to the field element. Compute once in the caller via `$props.id()`. */
  fieldId: string;
  /** Helper text shown below the field when no error is set. */
  helper?: string;
  /** Error message — when truthy, replaces `helper` and flags the field invalid. */
  error?: string;
  /** Required flag — exposed verbatim for the caller's label markup. */
  required?: boolean;
  /** Disabled flag — exposed verbatim. */
  disabled?: boolean;
}

export interface UseFormFieldReturn {
  /** Stable id to apply to the field's interactive element + its `<label for>`. */
  readonly fieldId: string;
  /** Id of the error description, or undefined when no error is set. */
  readonly errorId: string | undefined;
  /** Id of the helper description, or undefined when error is set or no helper is given. */
  readonly helperId: string | undefined;
  /** Concatenation suitable for `aria-describedby` (`undefined` when both are unset). */
  readonly describedBy: string | undefined;
  /** `true` iff `error` is truthy. Use for `aria-invalid={ff.invalid || undefined}`. */
  readonly invalid: boolean;
  /** Pass-through of `required` for layout convenience. */
  readonly required: boolean;
  /** Pass-through of `disabled` for layout convenience. */
  readonly disabled: boolean;
}

/**
 * Pure-function core of the hook. Test this directly — the reactive
 * `useFormField` wrapper has no logic of its own beyond `$derived`
 * subscription.
 */
export function computeFormFieldAria(input: UseFormFieldInputs): UseFormFieldReturn {
  const fieldId = input.fieldId;
  const errorId = input.error ? `${fieldId}-error` : undefined;
  // Helper is suppressed when an error is present — the error message is
  // the more important description at that point. This is the same
  // exclusive convention as Material / Carbon / Polaris.
  const helperId = !input.error && input.helper ? `${fieldId}-helper` : undefined;
  // Error first, helper second — error is the more semantically urgent
  // description and should reach assistive tech first.
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  const invalid = !!input.error;
  const required = !!input.required;
  const disabled = !!input.disabled;
  return {
    fieldId,
    errorId,
    helperId,
    describedBy,
    invalid,
    required,
    disabled
  };
}

export function useFormField(inputs: () => UseFormFieldInputs): UseFormFieldReturn {
  const result = $derived(computeFormFieldAria(inputs()));
  return {
    get fieldId() {
      return result.fieldId;
    },
    get errorId() {
      return result.errorId;
    },
    get helperId() {
      return result.helperId;
    },
    get describedBy() {
      return result.describedBy;
    },
    get invalid() {
      return result.invalid;
    },
    get required() {
      return result.required;
    },
    get disabled() {
      return result.disabled;
    }
  };
}
