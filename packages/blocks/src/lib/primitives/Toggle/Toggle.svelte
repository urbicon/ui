<script lang="ts">
  import { useBlocksI18n, mintAttachment } from '$lib';
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext, useFormField } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';
  import { toggleVariants, type ToggleVariants } from './toggle.variants';
  import type { ToggleProps } from './index';

  const bt = useBlocksI18n();

  let {
    checked = $bindable(false),
    label,
    helper,
    error,
    tier,
    size = 'md',
    intent = 'primary',
    variant = 'default',
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
    'aria-describedby': ariaDescribedby,
    'aria-label': ariaLabel,
    ...restProps
  }: ToggleProps = $props();

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
    variant,
    checked,
    disabled,
    error: !!error,
    withBorder
  });

  const styles = $derived(toggleVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'Toggle',
      preset,
      variantProps,
      slotClassesProp,
      toggleVariants.config
    )
  );

  const dataState = $derived(checked ? 'checked' : 'unchecked');

  // Mint targets the directional switch track, not the enclosing <label> that
  // also wraps the text — a hover/scale effect belongs to the control surface,
  // mirroring SegmentItem/Button (XC-1).
  function handleChange() {
    if (disabled) return;
    onCheckedChange?.(checked);
  }
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.wrapper, className)
    : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
>
  <label
    class={unstyled
      ? (slotClasses?.control ?? '')
      : styles.control({ class: slotClasses?.control })}
    for={ff.fieldId}
  >
    <!-- aria-label: a visible `label` wins (stays undefined); with no label a
         consumer-supplied aria-label is preferred over the generic i18n fallback
         so external labelling survives the restProps-first spread. -->
    <input
      {...restProps}
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
      aria-label={label ? undefined : (ariaLabel ?? (bt('accessibility.toggle') || 'Toggle'))}
      aria-describedby={describedBy}
      aria-invalid={ff.invalid ? 'true' : undefined}
      onchange={handleChange}
    />

    <span
      class={unstyled ? (slotClasses?.track ?? '') : styles.track({ class: slotClasses?.track })}
      {@attach mintAttachment(mint, { enabled: !disabled })}
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

  <CoreFieldMessage
    {error}
    {helper}
    errorId={ff.errorId}
    helperId={ff.helperId}
    class={unstyled
      ? (slotClasses?.message ?? '')
      : styles.message({ class: slotClasses?.message })}
  />
</div>
