<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { SparklineProps } from './index';
  import {
    sparklineVariants,
    type SparklineSlots,
    type SparklineVariants
  } from './sparkline.variants';
  import { linearScale, linePath, areaPath, extent } from '$lib/internal/charts/utils';
  import type { ChartPoint } from '$lib/internal/charts/utils';
  import { resolveClassChain } from '$lib/utils/variants';

  let {
    data,
    width = 96,
    height = 24,
    fluid = false,
    area = false,
    showEndPoint = false,
    color = 'var(--color-chart-1)',
    strokeWidth = 1.5,
    ariaLabel,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: SparklineProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const variantProps: SparklineVariants = $derived({ fluid });
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'Sparkline', preset, variantProps, slotClassesProp)
  );

  // DEV migration aid for the v9 slot rename, on the same `import.meta.env?.DEV
  // && console.warn` idiom as Table's `wrapper`→`scrollArea` notice. Read off
  // the RESOLVED map, not `slotClassesProp`: `ComponentDefaults['slotClasses']`,
  // `ComponentPreset['slotClasses']` and `ConditionalOverride['class']` are all
  // `Record<string, string>`, so a stale key written under a `<BlocksProvider>`
  // passes every check the instance prop fails at compile time. The resolved
  // map is the one place all five sources have already been folded together.
  if (import.meta.env?.DEV) {
    const stale = ['line', 'point'].filter((key) => key in slotClasses);
    if (stale.length > 0) {
      console.warn(
        `[Sparkline] slotClasses.${stale.join(' and slotClasses.')} no longer resolves: ` +
          '`line` is now `mark`, `point` is now `endPoint`. Check the instance prop and any ' +
          "<BlocksProvider> defaults, presets or overrides under the 'Sparkline' key."
      );
    }
  }

  // Inset so the stroke + end-point aren't clipped at the edges.
  const pad = $derived(Math.max(strokeWidth, 1));

  const geometry = $derived.by(() => {
    const [min, max] = extent(data);
    const x = linearScale([0, Math.max(1, data.length - 1)], [pad, width - pad]);
    const y = linearScale([min, max], [height - pad, pad]);
    const points: ChartPoint[] = data.map((v, i) => [x(i), y(v)]);
    return {
      lineD: linePath(points),
      areaD: area ? areaPath(points, height - pad) : '',
      last: points[points.length - 1] as ChartPoint | undefined
    };
  });

  const styles = $derived(unstyled ? undefined : sparklineVariants(variantProps));

  function slot(name: SparklineSlots, extra?: string): string {
    const overrides = resolveClassChain(slotClasses[name], extra);
    return styles?.[name]({ class: overrides }) ?? overrides;
  }
</script>

<span
  {...rest}
  class={slot('root', className)}
  role={ariaLabel ? 'img' : undefined}
  aria-label={ariaLabel}
  aria-hidden={ariaLabel ? undefined : 'true'}
>
  <svg
    class={slot('svg')}
    width={fluid ? undefined : width}
    height={fluid ? undefined : height}
    viewBox="0 0 {width} {height}"
    preserveAspectRatio="none"
  >
    {#if area && geometry.areaD}
      <path
        class={slot('area')}
        d={geometry.areaD}
        fill={color}
        fill-opacity="0.15"
        stroke="none"
      />
    {/if}
    {#if geometry.lineD}
      <path
        class={slot('mark')}
        d={geometry.lineD}
        fill="none"
        stroke={color}
        stroke-width={strokeWidth}
        stroke-linejoin="round"
        stroke-linecap="round"
        vector-effect={fluid ? 'non-scaling-stroke' : undefined}
      />
    {/if}
    {#if showEndPoint && geometry.last}
      <circle
        class={slot('endPoint')}
        cx={geometry.last[0]}
        cy={geometry.last[1]}
        r={strokeWidth + 0.5}
        fill={color}
      />
    {/if}
  </svg>
</span>
