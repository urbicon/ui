<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { AreaChartProps } from './index';
  import type { ChartSeries } from '$lib/internal/charts/types';
  import { chartSlotResolver } from '$lib/internal/charts/variants';
  import {
    linearScale,
    niceScale,
    linePath,
    areaPath,
    seriesColor,
    numberFormatter,
    extent
  } from '$lib/internal/charts/utils';
  import type { ChartPoint } from '$lib/internal/charts/utils';
  import ChartFrame from '../ChartFrame/ChartFrame.svelte';

  let {
    data,
    series: seriesProp,
    stacked = false,
    fillOpacity,
    height = 240,
    width,
    margin,
    formatValue,
    locale,
    showLegend = true,
    showGrid = true,
    ariaLabel,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: AreaChartProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.AreaChart?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'AreaChart', preset),
      slotClassesProp
    )
  );
  const slot = $derived(chartSlotResolver(unstyled, slotClasses));

  const seriesCount = $derived(
    Math.max(1, seriesProp?.length ?? 0, ...data.map((d) => d.values.length))
  );
  const resolvedSeries = $derived<ChartSeries[]>(
    seriesProp && seriesProp.length > 0
      ? seriesProp
      : Array.from({ length: seriesCount }, (_, i) => ({ label: `Series ${i + 1}` }))
  );

  const fmt = $derived(formatValue ?? numberFormatter(locale));
  const opacity = $derived(fillOpacity ?? (stacked ? 0.85 : 0.2));

  const domain = $derived.by<[number, number]>(() => {
    if (stacked) {
      let max = 0;
      let min = 0;
      for (const d of data) {
        let sum = 0;
        resolvedSeries.forEach((_s, si) => {
          sum += d.values[si] ?? 0;
        });
        if (sum > max) max = sum;
        if (sum < min) min = sum;
      }
      return [Math.min(0, min), max];
    }
    const all = data.flatMap((d) => resolvedSeries.map((_s, si) => d.values[si] ?? 0));
    const [mn, mx] = extent(all);
    return [Math.min(0, mn), mx];
  });
  const nice = $derived(niceScale(domain[0], domain[1], 5, true));

  function xAt(index: number, innerWidth: number): number {
    return data.length <= 1 ? innerWidth / 2 : (index / (data.length - 1)) * innerWidth;
  }

  interface SeriesArea {
    color: string;
    label: string;
    areaD: string;
    lineD: string;
  }

  function computeAreas(innerWidth: number, innerHeight: number): SeriesArea[] {
    const y = linearScale([nice.min, nice.max], [innerHeight, 0]);

    if (stacked) {
      const cumulative = data.map(() => 0);
      return resolvedSeries.map((s, si) => {
        const lower: ChartPoint[] = data.map((_d, i) => [xAt(i, innerWidth), y(cumulative[i])]);
        data.forEach((d, i) => {
          cumulative[i] += d.values[si] ?? 0;
        });
        const upper: ChartPoint[] = data.map((_d, i) => [xAt(i, innerWidth), y(cumulative[i])]);
        // Closed polygon: top edge forward, lower edge back. linePath() applies
        // the shared coord() rounding so both edges format consistently.
        const ring: ChartPoint[] = [...upper, ...lower.slice().reverse()];
        return {
          color: seriesColor(si, s.color),
          label: s.label,
          areaD: `${linePath(ring)}Z`,
          lineD: linePath(upper)
        };
      });
    }

    const baselineY = y(0);
    return resolvedSeries.map((s, si) => {
      const points: ChartPoint[] = data.map((d, i) => [xAt(i, innerWidth), y(d.values[si] ?? 0)]);
      return {
        color: seriesColor(si, s.color),
        label: s.label,
        areaD: areaPath(points, baselineY),
        lineD: linePath(points)
      };
    });
  }

  const resolvedAriaLabel = $derived(
    ariaLabel ??
      `Area chart: ${data.length} points` +
        (resolvedSeries.length > 1 ? `, ${resolvedSeries.length} series` : '') +
        (stacked ? ', stacked' : '')
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
    {@const areas = computeAreas(plot.innerWidth, plot.innerHeight)}

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

    <!-- series areas -->
    {#each areas as area, si (area.label + ' ' + si)}
      <path
        class={slot('mark')}
        d={area.areaD}
        fill={area.color}
        fill-opacity={opacity}
        stroke="none"
      />
      <path
        class={slot('mark')}
        d={area.lineD}
        fill="none"
        stroke={area.color}
        stroke-width="1.5"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
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
          <th scope="col">Category</th>
          {#each resolvedSeries as s, i (s.label + ' ' + i)}
            <th scope="col">{s.label || `Series ${i + 1}`}</th>
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
