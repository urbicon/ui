<script lang="ts">
  import { useBlocksI18n, mintRegistry } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext, useFormField } from '$lib/utils';
  import { toggleVariants, type ToggleVariants } from './toggle.variants';
  import type { ToggleProps } from './index';

  const bt = useBlocksI18n();

  let {
    checked = $bindable(false),
    label,
    helper,
    tier,
    size = 'md',
    intent = 'primary',
    appearance = 'default',
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
    withBorder = false,
    ...restProps
  }: ToggleProps = $props();

  // ARIA wiring is shared with every form primitive — see XC-2.
  const propsId = $props.id();
  const id = $derived(idProp ?? propsId);
  const ff = useFormField(() => ({
    fieldId: id,
    helper,
    required,
    disabled
  }));

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  let trackElement = $state<HTMLElement>();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar / ButtonGroup)
  // → 'commit' default. A bare Toggle is a Pill switch; a Toolbar tier="modify"
  // re-frames it as a compact rectangular switch.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the toggle's active variants.
  const variantProps: ToggleVariants = $derived({
    tier: effectiveTier,
    size,
    intent,
    appearance,
    checked,
    disabled,
    withBorder
  });

  const styles = $derived(toggleVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Toggle', preset, variantProps, slotClassesProp)
  );

  const dataState = $derived(checked ? 'checked' : 'unchecked');

  // Mint targets the directional switch track, not the enclosing <label> that
  // also wraps the text — a hover/scale effect belongs to the control surface,
  // mirroring SegmentItem/Button (XC-1).
  $effect(() => {
    if (trackElement && mint && mint !== 'none' && !disabled) {
      return mintRegistry.apply(trackElement, mint);
    }
  });

  function handleChange() {
    if (disabled) return;
    onCheckedChange?.(checked);
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
    for={ff.fieldId}
  >
    <input
      id={ff.fieldId}
      type="checkbox"
      role="switch"
      {name}
      {value}
      bind:checked
      {disabled}
      {required}
      class="peer sr-only"
      aria-checked={checked}
      aria-label={label ? undefined : bt('accessibility.toggle') || 'Toggle'}
      aria-describedby={ff.describedBy}
      onchange={handleChange}
      {...restProps}
    />

    <span
      class={unstyled ? (slotClasses?.track ?? '') : styles.track({ class: slotClasses?.track })}
      bind:this={trackElement}
      aria-hidden="true"
      data-state={dataState}
    >
      <span
        class={unstyled ? (slotClasses?.thumb ?? '') : styles.thumb({ class: slotClasses?.thumb })}
        data-state={dataState}
      ></span>
    </span>

    {#if label}
      <span
        class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
        >{label}</span
      >
    {/if}
  </label>

  {#if ff.helperId}
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
