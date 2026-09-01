<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useBlocksI18n } from '$lib';
  import { stepperVariants, type StepperVariants } from './stepper.variants';
  import { getStepperContext } from './stepper.context';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
  import { resolveClassChain } from '$lib/utils/variants';
  import type { StepperStepProps } from './index';

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const WarningIcon = resolveIcon('warning', WarningTriangleIconDefault);

  let {
    label,
    description,
    icon,
    // Renamed locally: a binding called `state` would make `$state` below read
    // as a store subscription (store_rune_conflict).
    state: stateProp,
    optional = false,
    disabled: disabledProp = false,
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: StepperStepProps = $props();

  const blocksConfig = getBlocksConfig();
  const bt = useBlocksI18n();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const ctx = getStepperContext();
  // Init order is only the SSR/first-paint truth. Once mounted, the index
  // follows the node's DOM position via the context, so a step inserted
  // mid-list (keyed {#each} over a filtered list) numbers by where it SITS,
  // not by when it initialised — see the note in Stepper.svelte.
  const initIndex = ctx.registerStep();
  let liNode = $state<HTMLElement | null>(null);
  const stepIndex = $derived.by(() => {
    if (!liNode) return initIndex;
    const domIndex = ctx.stepIndexOf(liNode);
    return domIndex === -1 ? initIndex : domIndex;
  });

  const attachStepNode = (node: HTMLElement) => {
    liNode = node;
    ctx.attachStep(node);
    return () => {
      ctx.detachStep(node);
      liNode = null;
    };
  };

  const derivedState = $derived(
    stateProp
      ? stateProp
      : stepIndex < ctx.activeStep
        ? 'complete'
        : stepIndex === ctx.activeStep
          ? 'active'
          : 'inactive'
  );

  const isDisabled = $derived(disabledProp || ctx.disabled);
  const isClickable = $derived(
    ctx.clickable &&
      !isDisabled &&
      derivedState !== 'active' &&
      (!ctx.linear || stepIndex <= ctx.activeStep + 1)
  );
  const isSeparatorComplete = $derived(stepIndex < ctx.activeStep);
  const isActive = $derived(stepIndex === ctx.activeStep);

  const variantProps: StepperVariants = $derived({
    orientation: ctx.orientation,
    size: ctx.size,
    variant: ctx.variant,
    tier: ctx.tier,
    state: derivedState,
    clickable: isClickable,
    disabled: isDisabled,
    separatorComplete: isSeparatorComplete
  });

  const styles = $derived(
    unstyled
      ? {
          stepItem: () => '',
          step: () => '',
          indicatorColumn: () => '',
          indicator: () => '',
          labelGroup: () => '',
          label: () => '',
          description: () => '',
          separator: () => '',
          content: () => ''
        }
      : stepperVariants(variantProps)
  );

  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'StepperStep',
      preset,
      variantProps,
      slotClassesProp,
      stepperVariants.config
    )
  );

  function slot(key: keyof typeof styles, extra?: string, variants?: StepperVariants) {
    const overrides = resolveClassChain(slotClasses?.[key as keyof typeof slotClasses], extra);
    if (unstyled) return overrides;
    const fn = styles[key];
    return typeof fn === 'function' ? fn({ ...variants, class: overrides }) : overrides;
  }

  function handleClick() {
    if (isClickable) ctx.goToStep(stepIndex);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (!isClickable) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      ctx.goToStep(stepIndex);
    }
  }

  const iconSize = $derived(ctx.size === 'sm' ? 14 : ctx.size === 'lg' ? 20 : 16);
  const contentPl = $derived(ctx.size === 'sm' ? 'pl-2' : ctx.size === 'lg' ? 'pl-3' : 'pl-2.5');
</script>

{#snippet indicatorContent()}
  {#if icon}
    {@render icon()}
  {:else if derivedState === 'complete'}
    <CheckIcon size={iconSize} />
  {:else if derivedState === 'error'}
    <CloseIcon size={iconSize} />
  {:else if derivedState === 'warning'}
    <WarningIcon size={iconSize} />
  {:else}
    {stepIndex + 1}
  {/if}
{/snippet}

{#snippet labelContent()}
  <div class={slot('labelGroup')}>
    <span class={slot('label')}>{label}</span>
    {#if description}
      <span class={slot('description')}>{description}</span>
    {/if}
    {#if optional}
      <span class={slot('description', undefined, { optionalNote: true })}
        >{bt('stepper.optional')}</span
      >
    {/if}
  </div>
{/snippet}

{#if ctx.orientation === 'horizontal'}
  <li
    class={slot('stepItem', className)}
    aria-current={isActive ? 'step' : undefined}
    {...restProps}
    {@attach attachStepNode}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class={slot('step')}
      role={isClickable ? 'button' : undefined}
      tabindex={isClickable ? 0 : undefined}
      onclick={handleClick}
      onkeydown={handleKeydown}
    >
      <div class={slot('indicator')}>
        {@render indicatorContent()}
      </div>
      {@render labelContent()}
    </div>
    <div data-stepper-separator class={slot('separator')}></div>
  </li>
{:else}
  <li
    aria-current={isActive ? 'step' : undefined}
    class={slot('stepItem', className)}
    {...restProps}
    {@attach attachStepNode}
  >
    <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
    <div
      class={slot('step')}
      role={isClickable ? 'button' : undefined}
      tabindex={isClickable ? 0 : undefined}
      onclick={handleClick}
      onkeydown={handleKeydown}
    >
      <div class={slot('indicator')}>
        {@render indicatorContent()}
      </div>
      {@render labelContent()}
    </div>
    <div class="flex">
      <div class={slot('indicatorColumn')}>
        <div data-stepper-separator class={slot('separator')}></div>
      </div>
      <div class="min-w-0 flex-1 {contentPl}">
        {#if children}
          <div class={slot('content')}>
            {@render children()}
          </div>
        {/if}
      </div>
    </div>
  </li>
{/if}
