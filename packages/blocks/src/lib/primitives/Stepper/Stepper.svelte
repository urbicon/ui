<script lang="ts">
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import { stepperVariants, type StepperVariants } from './stepper.variants';
  import { setStepperContext } from './stepper.context';
  import type { StepperProps, StepperContext } from './index';

  const bt = useBlocksI18n();

  let {
    activeStep = $bindable(0),
    orientation = 'horizontal',
    variant = 'default',
    size = 'md',
    tier,
    linear = false,
    clickable = false,
    disabled = false,
    responsive = false,
    onStepChange,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: StepperProps = $props();

  // Tier precedence (closest wins): own prop → TierContext (Toolbar /
  // ButtonGroup) → 'commit' default. Propagated through the StepperContext
  // so every StepperStep renders with the same radius family.
  const tierCtx = getTierContext();
  const effectiveTier = $derived(tier ?? tierCtx?.tier ?? 'commit');

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const responsiveBreakpoint = $derived(
    responsive === true ? 640 : typeof responsive === 'object' ? (responsive.breakpoint ?? 640) : 0
  );

  let rootRef = $state<HTMLOListElement>();
  let measuredWidth = $state<number | null>(null);

  $effect(() => {
    if (!rootRef || !responsiveBreakpoint) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === 'number') measuredWidth = w;
    });
    ro.observe(rootRef);
    return () => ro.disconnect();
  });

  const isCompact = $derived(
    responsiveBreakpoint > 0 && measuredWidth !== null && measuredWidth < responsiveBreakpoint
  );
  const effectiveOrientation = $derived(isCompact ? 'vertical' : orientation);
  const effectiveVariant = $derived(isCompact ? 'minimal' : variant);

  const variantProps: StepperVariants = $derived({
    orientation: effectiveOrientation,
    size,
    variant: effectiveVariant,
    tier: effectiveTier
  });

  const styles = $derived(unstyled ? { base: () => '' } : stepperVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Stepper', preset, variantProps, slotClassesProp)
  );

  let nextIdx = 0;

  function goToStep(index: number) {
    if (disabled) return;
    if (index === activeStep) return;
    if (linear && index > activeStep + 1) return;
    activeStep = index;
    onStepChange?.(index);
  }

  const ctx: StepperContext = {
    registerStep() {
      return nextIdx++;
    },
    goToStep,
    get activeStep() {
      return activeStep;
    },
    get orientation() {
      return effectiveOrientation;
    },
    get variant() {
      return effectiveVariant;
    },
    get size() {
      return size;
    },
    get tier() {
      return effectiveTier;
    },
    get linear() {
      return linear;
    },
    get clickable() {
      return clickable;
    },
    get disabled() {
      return disabled;
    }
  };

  setStepperContext(ctx);
</script>

<ol
  bind:this={rootRef}
  class={unstyled
    ? [slotClasses?.base, className].filter(Boolean).join(' ')
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={bt('accessibility.progress')}
  data-orientation={effectiveOrientation}
  {...restProps}
>
  {@render children()}
</ol>
