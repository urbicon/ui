<script lang="ts">
  import type { ChartFrameProps } from './index';
  import type { ChartMargin } from '$lib/internal/charts/types';
  import { chartSlotResolver } from '$lib/internal/charts/variants';

  let {
    height = 240,
    width: widthProp,
    margin: marginProp,
    ariaLabel,
    children,
    legend,
    fallback,
    class: className,
    unstyled = false,
    slotClasses = {},
    ...rest
  }: ChartFrameProps = $props();

  const DEFAULT_MARGIN: Required<ChartMargin> = { top: 8, right: 12, bottom: 28, left: 40 };
  const margin: Required<ChartMargin> = $derived({
    top: marginProp?.top ?? DEFAULT_MARGIN.top,
    right: marginProp?.right ?? DEFAULT_MARGIN.right,
    bottom: marginProp?.bottom ?? DEFAULT_MARGIN.bottom,
    left: marginProp?.left ?? DEFAULT_MARGIN.left
  });

  // Responsive width via ResizeObserver. `widthProp` forces a fixed width
  // (SSR-stable, opts out of measurement). 320 is the pre-measure fallback.
  let measured = $state(0);
  const width = $derived(widthProp ?? (measured > 0 ? measured : 320));
  const innerWidth = $derived(Math.max(0, width - margin.left - margin.right));
  const innerHeight = $derived(Math.max(0, height - margin.top - margin.bottom));

  const slot = $derived(chartSlotResolver(unstyled, slotClasses));

  function measure(node: HTMLElement) {
    if (widthProp !== undefined) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) measured = w;
    });
    observer.observe(node);
    return () => observer.disconnect();
  }
</script>

<figure {...rest} {@attach measure} class={slot('root', className)}>
  <svg
    class={slot('svg')}
    viewBox="0 0 {width} {height}"
    width="100%"
    {height}
    role="img"
    aria-label={ariaLabel}
    preserveAspectRatio="xMidYMid meet"
  >
    <g transform="translate({margin.left}, {margin.top})">
      {@render children?.({ width, height, innerWidth, innerHeight, margin })}
    </g>
  </svg>

  {#if legend}
    {@render legend()}
  {/if}

  {#if fallback}
    <div class="sr-only">
      {@render fallback()}
    </div>
  {/if}
</figure>
