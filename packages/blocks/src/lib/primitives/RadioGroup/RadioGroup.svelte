<script lang="ts">
  import CoreFieldMessage from '$lib/internal/core/CoreFieldMessage.svelte';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext, useFormField } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { RadioGroupProps } from './index';
  import { setRadioGroupContext } from './radioGroup.context';
  import { radioGroupVariants, type RadioGroupVariants } from './radioGroup.variants';

  let {
    children,
    value = $bindable(),
    name: nameProp,
    orientation = 'vertical',
    size = 'md',
    intent = 'primary',
    variant = 'outlined',
    tier,
    disabled = false,
    required = false,
    error,
    helper,
    label,
    onValueChange,
    mint = 'none',
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    id,
    'aria-describedby': ariaDescribedby,
    'aria-labelledby': ariaLabelledby,
    ...restProps
  }: RadioGroupProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'commit' default. Propagated through RadioGroupContext
  // so every RadioItem indicator shares the same radius family.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const propsId = $props.id();
  const name = $derived(nameProp ?? `radio-${propsId}`);

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const groupId = $derived(id || `radiogroup-${propsId}`);
  // When a `label` is rendered it owns the group's `aria-labelledby`; otherwise a
  // consumer-supplied `aria-labelledby` (an external heading) is used as the
  // fallback so external labelling survives (see the group element below).
  const labelId = $derived(label ? `${groupId}-label` : undefined);
  // ARIA wiring is shared with every form primitive — see XC-2.
  const ff = useFormField(() => ({
    fieldId: groupId,
    helper,
    error,
    required,
    disabled
  }));

  // Consumer-supplied `aria-describedby` (e.g. an external hint rendered
  // outside the component) merges with the internal error/helper chain instead
  // of replacing it — internal descriptions first, the consumer's supplemental
  // one last (mirrors the Input role model, XC-2). Applied to the group element.
  const describedBy = $derived(
    [ff.describedBy, ariaDescribedby].filter(Boolean).join(' ') || undefined
  );

  // Variant props feed both the tv() style computation and the slot-class
  // cascade — extracted into one derived so `resolveSlotClasses` can match
  // conditional `overrides` against the group's active variants.
  const variantProps: RadioGroupVariants = $derived({
    orientation,
    required: required || undefined,
    error: !!error,
    disabled: disabled
  });

  const styles = $derived(radioGroupVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'RadioGroup',
      preset,
      variantProps,
      slotClassesProp,
      radioGroupVariants.config
    )
  );

  function select(itemValue: string) {
    if (disabled) return;
    value = itemValue;
    onValueChange?.(itemValue);
  }

  let groupElement = $state<HTMLDivElement>();

  function handleKeydown(event: KeyboardEvent) {
    if (!groupElement) return;
    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';

    if (event.key !== nextKey && event.key !== prevKey) return;

    event.preventDefault();
    const radios = Array.from(
      groupElement.querySelectorAll<HTMLInputElement>('input[type="radio"]:not(:disabled)')
    );
    if (radios.length === 0) return;

    const currentIndex = radios.findIndex((r) => r === document.activeElement);
    let nextIndex: number;

    if (event.key === nextKey) {
      nextIndex = currentIndex < radios.length - 1 ? currentIndex + 1 : 0;
    } else {
      nextIndex = currentIndex > 0 ? currentIndex - 1 : radios.length - 1;
    }

    radios[nextIndex].focus();
    radios[nextIndex].click();
  }

  setRadioGroupContext({
    get name() {
      return name;
    },
    get size() {
      return size;
    },
    get intent() {
      return intent;
    },
    get variant() {
      return variant;
    },
    get tier() {
      return effectiveTier;
    },
    get disabled() {
      return disabled;
    },
    get error() {
      return !!error;
    },
    get value() {
      return value;
    },
    get mint() {
      return mint;
    },
    get required() {
      return required;
    },
    select
  });
</script>

<div
  class={unstyled
    ? resolveClassChain(slotClasses?.root, className)
    : styles.root({ class: [slotClasses?.root, className] })}
>
  {#if label}
    <span
      id={labelId}
      class={unstyled ? (slotClasses?.label ?? '') : styles.label({ class: slotClasses?.label })}
    >
      {label}
    </span>
  {/if}

  <div
    {...restProps}
    bind:this={groupElement}
    role="radiogroup"
    id={groupId}
    class={unstyled ? (slotClasses?.group ?? '') : styles.group({ class: slotClasses?.group })}
    aria-labelledby={labelId ?? ariaLabelledby}
    aria-describedby={describedBy}
    aria-required={required || undefined}
    aria-invalid={ff.invalid ? 'true' : undefined}
    onkeydown={handleKeydown}
  >
    {@render children()}
  </div>

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
