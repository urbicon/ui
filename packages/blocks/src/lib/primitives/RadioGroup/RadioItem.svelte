<script lang="ts">
  import { mintAttachment } from '$lib';
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

  /**
   * Roving tabindex: the checked radio is the group's single tab stop, and while
   * NOTHING is checked every enabled radio stays reachable — otherwise the group
   * drops out of the tab order entirely.
   *
   * "Nothing is checked" is `ctx.value === undefined`, which is what the context
   * types it for (`string | undefined`). This read `!ctx.value`, which also fired
   * for the empty string — and an empty string is an ordinary value. A group
   * whose "none" option is `value=""` therefore handed a tab stop to EVERY row
   * while resting on that option: the table's sort list with 20 sortable columns
   * cost 21 tab stops instead of one.
   */
  const rovingTabindex = $derived(isChecked || (ctx.value === undefined && !isDisabled) ? 0 : -1);

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the item's active variants.
  const variantProps: RadioItemVariants = $derived({
    size: ctx.size,
    intent: ctx.intent,
    variant: ctx.variant,
    tier: ctx.tier,
    checked: isChecked,
    // Layout axis, not state: a described row aligns the indicator with the
    // label's first line instead of centring it — see radioGroup.variants.ts.
    described: !!description || undefined,
    disabled: isDisabled || undefined,
    error: ctx.error || undefined
  });

  const styles = $derived(radioItemVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'RadioItem', preset, variantProps, slotClassesProp)
  );

  function handleChange() {
    if (isDisabled) return;
    ctx.select(value);
  }
</script>

<label
  class={unstyled
    ? [slotClasses?.item, className].filter(Boolean).join(' ')
    : styles.item({ class: [slotClasses?.item, className] })}
  {@attach mintAttachment(ctx.mint, { enabled: !isDisabled })}
  for={id}
>
  <!--
    `required` on every radio of the group, which is how HTML expresses a
    required radio group: the constraint belongs to the `name`, and any one
    radio carrying it makes the whole group required — so the browser blocks an
    empty submit and points at the group itself. Setting it on all of them (not
    just the first) keeps that true when items are conditional. Until
    2026-08-18 the group's `required` drew an asterisk and set aria-required
    and nothing stopped an empty submit.
  -->
  <input
    {...restProps}
    {id}
    type="radio"
    name={ctx.name}
    {value}
    checked={isChecked}
    disabled={isDisabled}
    required={ctx.required}
    class="peer sr-only"
    tabindex={rovingTabindex}
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
