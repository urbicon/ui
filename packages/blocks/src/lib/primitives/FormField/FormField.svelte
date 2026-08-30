<script lang="ts">
  import { useFormField } from '$lib/utils';
  import { formFieldVariants } from './form-field.variants';
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

  const styles = formFieldVariants();

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

<div {...rest} class={styles.wrapper({ class: [slotClasses.wrapper, className] })}>
  {#if label}
    <label for={ff.fieldId} class={styles.label({ class: slotClasses.label })}>
      {label}
      {#if ff.required}<span
          class={styles.requiredMark({ class: slotClasses.requiredMark })}
          aria-hidden="true">*</span
        >{/if}
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
    <div id={ff.errorId} role="alert" class={styles.message({ class: slotClasses.message })}>
      {error}
    </div>
  {:else if ff.helperId}
    <div id={ff.helperId} class={styles.helper({ class: slotClasses.helper })}>
      {helper}
    </div>
  {/if}
</div>
