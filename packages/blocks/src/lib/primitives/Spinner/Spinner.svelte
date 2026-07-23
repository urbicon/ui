<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  // internal core, not the public component — keeps the public-to-public import graph clean (see internal/core/)
  import { SPINNER_ARC_PATH } from '$lib/internal/core/spinner-geometry';
  import { spinnerVariants, type SpinnerVariants } from './spinner.variants';
  import type { SpinnerProps } from './index';

  let {
    variant = 'default',
    size = 'md',
    intent = 'primary',
    speed = 'normal',
    visible = true,
    label = 'Loading...',
    children,
    class: className = '',
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...restProps
  }: SpinnerProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);

  const variantProps: SpinnerVariants = $derived({ variant, size, intent, speed });
  const styles = $derived(spinnerVariants(variantProps));

  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Spinner', preset, variantProps, slotClassesProp)
  );
</script>

{#if visible}
  <div
    class={unstyled
      ? [slotClasses?.base, className].filter(Boolean).join(' ')
      : styles.base({ class: [slotClasses?.base, className] })}
    role="status"
    aria-label={label}
    aria-live="polite"
    aria-busy="true"
    {...restProps}
  >
    {#if variant === 'dots'}
      <div class={unstyled ? (slotClasses?.dots ?? '') : styles.dots({ class: slotClasses?.dots })}>
        <div
          class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
        ></div>
        <div
          class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
        ></div>
        <div
          class={unstyled ? (slotClasses?.dot ?? '') : styles.dot({ class: slotClasses?.dot })}
        ></div>
      </div>
    {:else if variant === 'pulse'}
      <div
        class={unstyled ? (slotClasses?.pulse ?? '') : styles.pulse({ class: slotClasses?.pulse })}
      >
        <div
          class={unstyled
            ? (slotClasses?.pulseRing ?? '')
            : styles.pulseRing({ class: slotClasses?.pulseRing })}
        ></div>
        <div
          class={unstyled
            ? (slotClasses?.pulseCenter ?? '')
            : styles.pulseCenter({ class: slotClasses?.pulseCenter })}
        ></div>
      </div>
    {:else if variant === 'ring'}
      <div class={unstyled ? (slotClasses?.ring ?? '') : styles.ring({ class: slotClasses?.ring })}>
        <div
          class={unstyled
            ? (slotClasses?.ringElement ?? '')
            : styles.ringElement({ class: slotClasses?.ringElement })}
        ></div>
        <div
          class={unstyled
            ? (slotClasses?.ringElement ?? '')
            : styles.ringElement({ class: slotClasses?.ringElement })}
        ></div>
        <div
          class={unstyled
            ? (slotClasses?.ringElement ?? '')
            : styles.ringElement({ class: slotClasses?.ringElement })}
        ></div>
        <div
          class={unstyled
            ? (slotClasses?.ringElement ?? '')
            : styles.ringElement({ class: slotClasses?.ringElement })}
        ></div>
      </div>
    {:else if variant === 'bars'}
      <div class={unstyled ? (slotClasses?.bars ?? '') : styles.bars({ class: slotClasses?.bars })}>
        <div
          class={unstyled ? (slotClasses?.bar ?? '') : styles.bar({ class: slotClasses?.bar })}
        ></div>
        <div
          class={unstyled ? (slotClasses?.bar ?? '') : styles.bar({ class: slotClasses?.bar })}
        ></div>
        <div
          class={unstyled ? (slotClasses?.bar ?? '') : styles.bar({ class: slotClasses?.bar })}
        ></div>
        <div
          class={unstyled ? (slotClasses?.bar ?? '') : styles.bar({ class: slotClasses?.bar })}
        ></div>
      </div>
    {:else}
      <svg
        class={unstyled ? (slotClasses?.svg ?? '') : styles.svg({ class: slotClasses?.svg })}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
          class={unstyled
            ? (slotClasses?.svgCircle ?? '')
            : styles.svgCircle({ class: slotClasses?.svgCircle })}
        />
        <path
          class={unstyled
            ? (slotClasses?.svgPath ?? '')
            : styles.svgPath({ class: slotClasses?.svgPath })}
          d={SPINNER_ARC_PATH}
        />
      </svg>
    {/if}

    {#if children}
      <div
        class={unstyled
          ? (slotClasses?.content ?? '')
          : styles.content({ class: slotClasses?.content })}
      >
        {@render children()}
      </div>
    {/if}

    <!--
      sr-only stays applied even when `unstyled` so the label never becomes
      visible — the accessibility contract (screen readers announce the
      spinner's purpose) must not depend on consumer theming.
    -->
    <span
      class={unstyled
        ? ['sr-only', slotClasses?.srOnly].filter(Boolean).join(' ')
        : styles.srOnly({ class: slotClasses?.srOnly })}
    >
      {label}
    </span>
  </div>
{/if}

<style>
  @keyframes -global-spinner-pulse {
    0% {
      transform: scale(1);
      opacity: 0.6;
    }
    100% {
      transform: scale(2);
      opacity: 0;
    }
  }

  @keyframes -global-spinner-bars {
    0%,
    40%,
    100% {
      transform: scaleY(0.4);
    }
    20% {
      transform: scaleY(1);
    }
  }

  @media print {
    :global([role='status']) {
      display: none !important;
    }
  }
</style>
