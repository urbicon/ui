<script lang="ts">
  import { useFormField } from '$lib/utils';
  import type { FormFieldProps } from './index';

  let {
    label,
    helper,
    error,
    required = false,
    disabled = false,
    id: idProp,
    class: className = '',
    slotClasses = {},
    children,
    ...rest
  }: FormFieldProps = $props();

  const propsId = $props.id();
  // ARIA wiring is shared with every individual form primitive — see
  // `useFormField` / XC-2 for the contract.
  const ff = useFormField(() => ({
    fieldId: idProp ?? `field-${propsId}`,
    helper,
    error,
    required,
    disabled
  }));
</script>

<div
  {...rest}
  class={['flex w-full flex-col gap-1.5', slotClasses.wrapper, className].filter(Boolean).join(' ')}
>
  {#if label}
    <label
      for={ff.fieldId}
      class={['text-text-secondary block text-sm font-medium', slotClasses.label]
        .filter(Boolean)
        .join(' ')}
    >
      {label}
      {#if ff.required}<span class="text-danger-text ml-0.5" aria-hidden="true">*</span>{/if}
    </label>
  {/if}

  {@render children({
    id: ff.fieldId,
    describedBy: ff.describedBy,
    invalid: ff.invalid,
    required: ff.required,
    disabled: ff.disabled
  })}

  {#if ff.errorId}
    <div
      id={ff.errorId}
      role="alert"
      class={['text-danger-text text-xs', slotClasses.message].filter(Boolean).join(' ')}
    >
      {error}
    </div>
  {:else if ff.helperId}
    <div
      id={ff.helperId}
      class={['text-text-tertiary text-xs', slotClasses.helper].filter(Boolean).join(' ')}
    >
      {helper}
    </div>
  {/if}
</div>
