<script lang="ts">
  import type { SparklineProps } from './index';
  import { linearScale, linePath, areaPath, extent } from '$lib/internal/charts/utils';
  import type { ChartPoint } from '$lib/internal/charts/utils';

  let {
    data,
    width = 96,
    height = 24,
    area = false,
    showEndPoint = false,
    color = 'var(--color-chart-1)',
    strokeWidth = 1.5,
    ariaLabel,
    class: className,
    unstyled = false,
    slotClasses = {},
    ...rest
  }: SparklineProps = $props();

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

  function slot(name: 'root' | 'svg' | 'line' | 'area' | 'point'): string {
    return slotClasses[name] ?? '';
  }
</script>

<span
  {...rest}
  class={[!unstyled && 'inline-block align-middle', slot('root'), className]}
  role={ariaLabel ? 'img' : undefined}
  aria-label={ariaLabel}
  aria-hidden={ariaLabel ? undefined : 'true'}
>
  <svg
    class={slot('svg')}
    {width}
    {height}
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
        class={slot('line')}
        d={geometry.lineD}
        fill="none"
        stroke={color}
        stroke-width={strokeWidth}
        stroke-linejoin="round"
        stroke-linecap="round"
      />
    {/if}
    {#if showEndPoint && geometry.last}
      <circle
        class={slot('point')}
        cx={geometry.last[0]}
        cy={geometry.last[1]}
        r={strokeWidth + 0.5}
        fill={color}
      />
    {/if}
  </svg>
</span>
