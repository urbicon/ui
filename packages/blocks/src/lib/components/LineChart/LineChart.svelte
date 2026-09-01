<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import type { LineChartProps } from './index';
  import type { ChartSeries } from '$lib/internal/charts/types';
  import { chartSlotResolver, chartVariants } from '$lib/internal/charts/variants';
  import {
    linearScale,
    niceScale,
    linePath,
    seriesColor,
    numberFormatter,
    extent
  } from '$lib/internal/charts/utils';
  import type { ChartPoint } from '$lib/internal/charts/utils';
  import ChartFrame from '../ChartFrame/ChartFrame.svelte';
  import { useBlocksI18n } from '$lib';

  let {
    data,
    series: seriesProp,
    height = 240,
    width,
    margin,
    formatValue,
    locale,
    showPoints = true,
    showLegend = true,
    showGrid = true,
    includeZero = false,
    ariaLabel,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: LineChartProps = $props();

  const blocksConfig = getBlocksConfig();
  const bt = useBlocksI18n();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'LineChart', preset, {}, slotClassesProp, chartVariants.config)
  );
  const slot = $derived(chartSlotResolver(unstyled, slotClasses));

  const seriesCount = $derived(
    Math.max(1, seriesProp?.length ?? 0, ...data.map((d) => d.values.length))
  );
  const resolvedSeries = $derived<ChartSeries[]>(
    seriesProp && seriesProp.length > 0
      ? seriesProp
      : Array.from({ length: seriesCount }, (_, i) => ({
          label: bt('chart.series', { index: i + 1 })
        }))
  );

  const fmt = $derived(formatValue ?? numberFormatter(locale));

  const domain = $derived.by<[number, number]>(() => {
    const all = data.flatMap((d) => resolvedSeries.map((_s, si) => d.values[si] ?? 0));
    return extent(all);
  });
  const nice = $derived(niceScale(domain[0], domain[1], 5, includeZero));

  // Point x-positions span the full plot width (first at 0, last at innerWidth).
  function xAt(index: number, innerWidth: number): number {
    return data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth;
  }

  interface SeriesLine {
    color: string;
    label: string;
    d: string;
    points: ChartPoint[];
  }

  function computeLines(innerWidth: number, innerHeight: number): SeriesLine[] {
    const y = linearScale([nice.min, nice.max], [innerHeight, 0]);
    return resolvedSeries.map((s, si) => {
      const points: ChartPoint[] = data.map((d, i) => [xAt(i, innerWidth), y(d.values[si] ?? 0)]);
      return { color: seriesColor(si, s.color), label: s.label, d: linePath(points), points };
    });
  }

  const resolvedAriaLabel = $derived(
    ariaLabel ??
      `Line chart: ${data.length} points` +
        (resolvedSeries.length > 1 ? `, ${resolvedSeries.length} series` : '')
  );
</script>

<ChartFrame
  {height}
  {width}
  {margin}
  ariaLabel={resolvedAriaLabel}
  {unstyled}
  {slotClasses}
  class={className}
  {...rest}
>
  {#snippet children(plot)}
    {@const yScale = linearScale([nice.min, nice.max], [plot.innerHeight, 0])}
    {@const lines = computeLines(plot.innerWidth, plot.innerHeight)}

    {#if showGrid}
      <g class={slot('grid')} aria-hidden="true">
        {#each nice.ticks as tick (tick)}
          <line x1="0" x2={plot.innerWidth} y1={yScale(tick)} y2={yScale(tick)} />
        {/each}
      </g>
    {/if}

    <!-- value axis -->
    <g class={slot('axis')} aria-hidden="true">
      {#each nice.ticks as tick (tick)}
        <text x="-8" y={yScale(tick)} dy="0.32em" text-anchor="end" class={slot('axisLabel')}>
          {fmt(tick)}
        </text>
      {/each}
    </g>

    <!-- category axis -->
    <g class={slot('axis')} aria-hidden="true">
      {#each data as datum, i (datum.label + ' ' + i)}
        <text
          x={xAt(i, plot.innerWidth)}
          y={plot.innerHeight + 16}
          text-anchor="middle"
          class={slot('axisLabel')}
        >
          {datum.label}
        </text>
      {/each}
    </g>

    <!-- series -->
    {#each lines as line, si (line.label + ' ' + si)}
      <path
        class={slot('mark')}
        d={line.d}
        fill="none"
        stroke={line.color}
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      {#if showPoints}
        {#each line.points as point, pi (pi)}
          <circle class={slot('point')} cx={point[0]} cy={point[1]} r="2.5" fill={line.color}>
            <title
              >{line.label ? `${line.label} — ` : ''}{data[pi].label}: {fmt(
                data[pi].values[si] ?? 0
              )}</title
            >
          </circle>
        {/each}
      {/if}
    {/each}
  {/snippet}

  {#snippet legend()}
    {#if showLegend && resolvedSeries.length > 1}
      <ul class={slot('legend')}>
        {#each resolvedSeries as s, i (s.label + ' ' + i)}
          <li class={slot('legendItem')}>
            <span class={slot('legendSwatch')} style="background-color: {seriesColor(i, s.color)}"
            ></span>
            {s.label}
          </li>
        {/each}
      </ul>
    {/if}
  {/snippet}

  {#snippet fallback()}
    <table>
      <caption>{resolvedAriaLabel}</caption>
      <thead>
        <tr>
          <th scope="col">{bt('chart.category')}</th>
          {#each resolvedSeries as s, i (s.label + ' ' + i)}
            <th scope="col">{s.label || bt('chart.series', { index: i + 1 })}</th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each data as datum, di (datum.label + ' ' + di)}
          {@const cells = resolvedSeries.map((_s, si) => datum.values[si] ?? 0)}
          <tr>
            <th scope="row">{datum.label}</th>
            {#each cells as cell, ci (ci)}
              <td>{fmt(cell)}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  {/snippet}
</ChartFrame>
