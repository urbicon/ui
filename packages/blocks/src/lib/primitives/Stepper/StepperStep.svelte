<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useBlocksI18n } from '$lib';
  import { stepperVariants, type StepperVariants } from './stepper.variants';
  import { getStepperContext } from './stepper.context';
  import { resolveIcon } from '$lib/icons';
  import CheckIconDefault from '$lib/icons/CheckIcon.svelte';
  import CloseIconDefault from '$lib/icons/CloseIcon.svelte';
  import WarningTriangleIconDefault from '$lib/icons/WarningTriangleIcon.svelte';
  import type { StepperStepProps } from './index';

  const CheckIcon = resolveIcon('check', CheckIconDefault);
  const CloseIcon = resolveIcon('close', CloseIconDefault);
  const WarningIcon = resolveIcon('warning', WarningTriangleIconDefault);

  let {
    label,
    description,
    icon,
    state,
    optional = false,
    disabled: stepDisabled = false,
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
  const stepIndex = ctx.registerStep();

  const derivedState = $derived(
    state
      ? state
      : stepIndex < ctx.activeStep
        ? 'complete'
        : stepIndex === ctx.activeStep
          ? 'active'
          : 'inactive'
  );

  const isDisabled = $derived(stepDisabled || ctx.disabled);
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
    stepState: derivedState,
    clickable: isClickable || undefined,
    stepDisabled: isDisabled || undefined,
    separatorComplete: isSeparatorComplete || undefined
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
    resolveSlotClasses(blocksConfig, 'StepperStep', preset, variantProps, slotClassesProp)
  );

  function slot(key: keyof typeof styles, extra?: string) {
    const overrides = [slotClasses?.[key as keyof typeof slotClasses], extra]
      .filter(Boolean)
      .join(' ');
    if (unstyled) return overrides;
    const fn = styles[key];
    return typeof fn === 'function' ? fn({ class: overrides }) : overrides;
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
      <span class="{slot('description')} italic">{bt('stepper.optional')}</span>
    {/if}
  </div>
{/snippet}

{#if ctx.orientation === 'horizontal'}
  <li
    class={slot('stepItem', className)}
    aria-current={isActive ? 'step' : undefined}
    {...restProps}
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
  <li aria-current={isActive ? 'step' : undefined} class={className || undefined} {...restProps}>
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
