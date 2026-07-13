<script lang="ts">
  import { mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext, useFormField } from '$lib/utils';
  import { checkboxVariants, type CheckboxVariants } from '$lib/primitives';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import MinusIconDefault from '$lib/icons/MinusIcon.svelte';
  import type { CheckboxProps } from './index';

  const CheckMarkIcon = resolveIcon('check', CheckIconDefault);
  const IndeterminateIcon = resolveIcon('minus', MinusIconDefault);

  let {
    checked = $bindable(false),
    indeterminate = $bindable(false),
    label,
    helper,
    error,
    tier,
    size = 'md',
    intent = 'primary',
    variant = 'outlined',
    disabled = false,
    required = false,
    name,
    value = 'on',
    id: idProp,
    mint = 'none',
    onCheckedChange,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    'aria-describedby': ariaDescribedby,
    ...restProps
  }: CheckboxProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'modify' default (checkbox is an input-tap surface).
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'modify');

  // ARIA wiring is shared with every form primitive — see XC-2.
  const propsId = $props.id();
  const id = $derived(idProp ?? propsId);
  const ff = useFormField(() => ({
    fieldId: id,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint rendered
  // outside the component) merges with the internal error/helper chain instead
  // of replacing it — internal descriptions first, the consumer's supplemental
  // one last (mirrors the Input role model, XC-2).
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let boxElement = $state<HTMLElement>();
  let inputRef = $state<HTMLInputElement>();

  const dataState = $derived(indeterminate ? 'indeterminate' : checked ? 'checked' : 'unchecked');

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the checkbox's active variants.
  const variantProps: CheckboxVariants = $derived({
    tier: effectiveTier,
    size,
    intent,
    variant,
    checked,
    indeterminate,
    disabled,
    error: !!error
  });

  const styles = $derived(checkboxVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Checkbox', preset, variantProps, slotClassesProp)
  );

  $effect(() => {
    if (inputRef) {
      inputRef.indeterminate = !!indeterminate;
    }
  });

  // Mint targets the directional box (the visual checkbox), not the enclosing
  // <label> that also wraps the text — a hover/scale effect belongs to the
  // control surface, mirroring SegmentItem/Button (XC-1).
  $effect(() => {
    if (boxElement && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(boxElement, mint);
    }
  });

  function handleChange(event: Event) {
    if (disabled) return;
    if (indeterminate) indeterminate = false;
    // Read the new value directly from the input — `bind:checked`
    // propagation may not have run yet when this handler executes.
    const next = (event.target as HTMLInputElement).checked;
    checked = next;
    onCheckedChange?.(next);
  }
</script>

<div
  class={unstyled
    ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  <label
    class={unstyled
      ? (slotClasses?.control ?? '')
      : styles.control({ class: slotClasses?.control })}
    for={id}
  >
    <input
      {...restProps}
      bind:this={inputRef}
      {id}
      type="checkbox"
      {name}
      {value}
      bind:checked
      {disabled}
      {required}
      class="peer sr-only"
      aria-checked={indeterminate ? 'mixed' : undefined}
      aria-invalid={ff.invalid ? 'true' : undefined}
      aria-describedby={describedBy}
      onchange={handleChange}
    />

    <span
      class={unstyled ? (slotClasses?.box ?? '') : styles.box({ class: slotClasses?.box })}
      bind:this={boxElement}
      aria-hidden="true"
      data-state={dataState}
    >
      {#if unstyled}
        <!-- Unstyled keeps the mount-on-state contract: consumers style via
             `data-state` on the box and rely on the icon only existing while
             checked/indeterminate. -->
        {#if indeterminate}
          <IndeterminateIcon class={slotClasses?.icon ?? ''} />
        {:else if checked}
          <CheckMarkIcon class={slotClasses?.icon ?? ''} strokeWidth={3} />
        {/if}
      {:else if indeterminate}
        <IndeterminateIcon class={styles.icon({ class: slotClasses?.icon })} strokeWidth={3} />
      {:else}
        <!-- Styled mode keeps the icon mounted even while unchecked (hidden by
             `opacity-0` + full stroke-dash offset) — a conditional mount would
             insert the element already at its resolved classes and the draw-in
             transition could never run. strokeWidth 3 matches the check and
             the minus so both states carry the same stroke weight. -->
        <CheckMarkIcon class={styles.icon({ class: slotClasses?.icon })} strokeWidth={3} />
      {/if}
    </span>

    {#if label}
      <span
        class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
        >{label}</span
      >
    {/if}
  </label>

  {#if ff.errorId}
    <div
      id={ff.errorId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
      role="alert"
    >
      {error}
    </div>
  {:else if ff.helperId}
    <div
      id={ff.helperId}
      class={unstyled
        ? (slotClasses?.message ?? '')
        : styles.message({ class: slotClasses?.message })}
    >
      {helper}
    </div>
  {/if}
</div>
