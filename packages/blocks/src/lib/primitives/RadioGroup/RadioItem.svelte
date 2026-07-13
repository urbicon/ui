<script lang="ts">
  import { mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { RadioItemProps } from './index';
  import { getRadioGroupContext } from './radioGroup.context';
  import { radioItemVariants, type RadioItemVariants } from './radioGroup.variants';

  let {
    value,
    label,
    description,
    disabled: disabledProp = false,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id: idProp,
    ...restProps
  }: RadioItemProps = $props();

  const propsId = $props.id();
  const id = $derived(idProp ?? propsId);

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const ctx = getRadioGroupContext();

  const isChecked = $derived(ctx.value === value);
  const isDisabled = $derived(ctx.disabled || disabledProp);
  const dataState = $derived(isChecked ? 'checked' : 'unchecked');

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the item's active variants.
  const variantProps: RadioItemVariants = $derived({
    size: ctx.size,
    intent: ctx.intent,
    variant: ctx.variant,
    tier: ctx.tier,
    checked: isChecked,
    disabled: isDisabled || undefined,
    error: ctx.error || undefined
  });

  const styles = $derived(radioItemVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'RadioItem', preset, variantProps, slotClassesProp)
  );

  let controlElement = $state<HTMLElement>();

  $effect(() => {
    if (controlElement && ctx.mint && ctx.mint !== 'none' && !isDisabled) {
      return mintRegistry.apply(controlElement, ctx.mint);
    }
  });

  function handleChange() {
    if (isDisabled) return;
    ctx.select(value);
  }
</script>

<label
  class={unstyled
    ? [slotClasses?.item, className].filter(Boolean).join(' ')
    : styles.item({ class: [slotClasses?.item, className] })}
  bind:this={controlElement}
  for={id}
>
  <input
    {...restProps}
    {id}
    type="radio"
    name={ctx.name}
    {value}
    checked={isChecked}
    disabled={isDisabled}
    class="peer sr-only"
    tabindex={isChecked || (!ctx.value && !isDisabled) ? 0 : -1}
    onchange={handleChange}
  />

  <span
    class={unstyled
      ? (slotClasses?.indicator ?? '')
      : styles.indicator({ class: slotClasses?.indicator })}
    aria-hidden="true"
    data-state={dataState}
  >
    <span class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
    ></span>
  </span>

  {#if label || description}
    <span class="flex flex-col">
      {#if label}
        <span
          class={unstyled
            ? (slotClasses?.label ?? '')
            : styles.label({ class: slotClasses?.label })}
        >
          {label}
        </span>
      {/if}
      {#if description}
        <span
          class={unstyled
            ? (slotClasses?.description ?? '')
            : styles.description({ class: slotClasses?.description })}
        >
          {description}
        </span>
      {/if}
    </span>
  {/if}
</label>
