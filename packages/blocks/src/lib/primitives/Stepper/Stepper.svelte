<script lang="ts">
  import { SvelteSet } from 'svelte/reactivity';
  import { useBlocksI18n } from '$lib';
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { getTierContext } from '$lib/utils';
  import { resolveClassChain } from '$lib/utils/variants';
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

  // A step's index must follow DOM order, not initialisation order: with a
  // keyed {#each}, a step inserted mid-list initialises LAST and a
  // register-counter alone hands it the highest index — the rail then shows
  // 1, 2, 4, 3 and complete/active are computed against the wrong positions
  // (measured on the decision-tree wizard recipe, whose hybrid step joins the
  // rail mid-flow). The counter stays as the SSR/first-paint value — server
  // rendering is strictly in order, and attachments only run in the browser —
  // and each mounted step re-derives its index from its node's position here.
  const stepNodes = new SvelteSet<HTMLElement>();
  const orderedStepNodes = $derived(
    Array.from(stepNodes).sort((a, b) =>
      a === b ? 0 : a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    )
  );

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
    attachStep(node) {
      stepNodes.add(node);
    },
    detachStep(node) {
      stepNodes.delete(node);
    },
    stepIndexOf(node) {
      return orderedStepNodes.indexOf(node);
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
    ? resolveClassChain(slotClasses?.base, className)
    : styles.base({ class: [slotClasses?.base, className] })}
  aria-label={bt('accessibility.progress')}
  data-orientation={effectiveOrientation}
  {...restProps}
>
  {@render children()}
</ol>
