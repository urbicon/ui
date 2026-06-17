<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import { useBlocksI18n } from '$lib';
  import type { ProgressProps } from './index';
  import { progressVariants } from './progress.variants';

  const bt = useBlocksI18n();

  let {
    value,
    min = 0,
    max = 100,
    label,
    showValue = false,
    formatValue,
    shape = 'linear',
    circularSize = 80,
    strokeWidth = 6,
    intent = 'primary',
    size = 'md',
    indeterminate: indeterminateProp,
    striped = false,
    animated = false,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: ProgressProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.Progress?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'Progress', preset),
      slotClassesProp
    )
  );

  const isIndeterminate = $derived(indeterminateProp || value === undefined);
  const clampedValue = $derived(value !== undefined ? Math.min(Math.max(value, min), max) : 0);
  const percentage = $derived(max - min > 0 ? ((clampedValue - min) / (max - min)) * 100 : 0);

  const defaultFormat = (v: number, m: number) => `${Math.round(((v - min) / (m - min)) * 100)}%`;
  const displayValue = $derived(
    formatValue ? formatValue(clampedValue, max) : defaultFormat(clampedValue, max)
  );

  const styles = $derived(
    progressVariants({
      intent,
      size,
      indeterminate: isIndeterminate || undefined,
      striped: striped || undefined,
      animated: animated || undefined
    })
  );

  const circularRadius = $derived((circularSize - strokeWidth) / 2);
  const circumference = $derived(2 * Math.PI * circularRadius);
  const circularOffset = $derived(
    isIndeterminate ? circumference * 0.75 : circumference * (1 - percentage / 100)
  );

  const circularSizeMap = { xs: 48, sm: 64, md: 80, lg: 112 };
  const strokeWidthMap = { xs: 3, sm: 4, md: 6, lg: 8 };

  const effectiveCircularSize = $derived(
    circularSize === 80 ? circularSizeMap[size ?? 'md'] : circularSize
  );
  const effectiveStrokeWidth = $derived(
    strokeWidth === 6 ? strokeWidthMap[size ?? 'md'] : strokeWidth
  );
  const effectiveRadius = $derived((effectiveCircularSize - effectiveStrokeWidth) / 2);
  const effectiveCircumference = $derived(2 * Math.PI * effectiveRadius);
  const effectiveOffset = $derived(
    isIndeterminate
      ? effectiveCircumference * 0.75
      : effectiveCircumference * (1 - percentage / 100)
  );
</script>

{#if shape === 'circular'}
  <div
    class={unstyled
      ? [slotClasses?.circularWrapper, className].filter(Boolean).join(' ')
      : styles.circularWrapper({ class: [slotClasses?.circularWrapper, className] })}
    role="progressbar"
    aria-valuenow={isIndeterminate ? undefined : clampedValue}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-label={label || bt('accessibility.progress') || 'Progress'}
    {...restProps}
  >
    <svg
      width={effectiveCircularSize}
      height={effectiveCircularSize}
      viewBox="0 0 {effectiveCircularSize} {effectiveCircularSize}"
      class={isIndeterminate ? 'animate-spin' : undefined}
      style="transform: rotate(-90deg)"
    >
      <circle
        cx={effectiveCircularSize / 2}
        cy={effectiveCircularSize / 2}
        r={effectiveRadius}
        fill="none"
        stroke-width={effectiveStrokeWidth}
        class={unstyled
          ? (slotClasses?.circularTrack ?? '')
          : styles.circularTrack({ class: slotClasses?.circularTrack })}
      />
      <circle
        cx={effectiveCircularSize / 2}
        cy={effectiveCircularSize / 2}
        r={effectiveRadius}
        fill="none"
        stroke-width={effectiveStrokeWidth}
        stroke-linecap="round"
        stroke-dasharray={effectiveCircumference}
        stroke-dashoffset={effectiveOffset}
        class={unstyled
          ? (slotClasses?.circularFill ?? '')
          : styles.circularFill({ class: slotClasses?.circularFill })}
      />
    </svg>
    {#if showValue && !isIndeterminate}
      <span
        class={unstyled
          ? (slotClasses?.circularLabel ?? '')
          : styles.circularLabel({ class: slotClasses?.circularLabel })}
        style="transform: rotate(0deg)"
      >
        {displayValue}
      </span>
    {/if}
  </div>
{:else}
  <div
    class={unstyled
      ? [slotClasses?.wrapper, className].filter(Boolean).join(' ')
      : styles.wrapper({ class: [slotClasses?.wrapper, className] })}
    role="progressbar"
    aria-valuenow={isIndeterminate ? undefined : clampedValue}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-label={label || bt('accessibility.progress') || 'Progress'}
    {...restProps}
  >
    {#if label || (showValue && !isIndeterminate)}
      <div
        class={unstyled
          ? (slotClasses?.header ?? '')
          : styles.header({ class: slotClasses?.header })}
      >
        {#if label}
          <span
            class={unstyled
              ? (slotClasses?.label ?? '')
              : styles.label({ class: slotClasses?.label })}
          >
            {label}
          </span>
        {/if}
        {#if showValue && !isIndeterminate}
          <span
            class={unstyled
              ? (slotClasses?.valueText ?? '')
              : styles.valueText({ class: slotClasses?.valueText })}
          >
            {displayValue}
          </span>
        {/if}
      </div>
    {/if}

    <div
      class={unstyled ? (slotClasses?.track ?? '') : styles.track({ class: slotClasses?.track })}
    >
      <div
        class={unstyled ? (slotClasses?.fill ?? '') : styles.fill({ class: slotClasses?.fill })}
        style={isIndeterminate ? undefined : `width: ${percentage}%`}
      ></div>
    </div>
  </div>
{/if}

<style>
  :global(.animate-progress-indeterminate) {
    animation: progress-indeterminate 1.5s var(--blocks-ease-confident) infinite;
  }

  :global(.animate-progress-striped) {
    animation: progress-striped 1s linear infinite;
  }

  @keyframes progress-indeterminate {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(400%);
    }
  }

  @keyframes progress-striped {
    0% {
      background-position: 1rem 0;
    }
    100% {
      background-position: 0 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.animate-progress-indeterminate),
    :global(.animate-progress-striped) {
      animation: none !important;
    }
  }
</style>
