<script lang="ts">
  import { getBlocksConfig, mergeSlotClasses, resolvePresetSlotClasses } from '$lib/provider';
  import type { BarChartProps } from './index';
  import type { ChartSeries } from '$lib/internal/charts/types';
  import { chartSlotResolver } from '$lib/internal/charts/variants';
  import {
    bandScale,
    linearScale,
    niceScale,
    seriesColor,
    numberFormatter,
    extent
  } from '$lib/internal/charts/utils';
  import ChartFrame from '../ChartFrame/ChartFrame.svelte';

  let {
    data,
    series: seriesProp,
    stacked = false,
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
  }: BarChartProps = $props();

  const blocksConfig = getBlocksConfig();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    mergeSlotClasses(
      blocksConfig?.defaults?.BarChart?.slotClasses,
      resolvePresetSlotClasses(blocksConfig?.presets, 'BarChart', preset),
      slotClassesProp
    )
  );
  const slot = $derived(chartSlotResolver(unstyled, slotClasses));

  // Resolve series: explicit prop wins; otherwise derive one entry per value
  // column found in the data (single bars when each datum has one value).
  const seriesCount = $derived(
    Math.max(1, seriesProp?.length ?? 0, ...data.map((d) => d.values.length))
  );
  const resolvedSeries = $derived<ChartSeries[]>(
    seriesProp && seriesProp.length > 0
      ? seriesProp
      : Array.from({ length: seriesCount }, (_, i) => ({ label: `Series ${i + 1}` }))
  );

  const fmt = $derived(formatValue ?? numberFormatter(locale));

  // Value-axis domain — pixel-independent, so it lives in the script.
  const domain = $derived.by<[number, number]>(() => {
    if (stacked) {
      let max = 0;
      let min = 0;
      for (const d of data) {
        let pos = 0;
        let neg = 0;
        resolvedSeries.forEach((_s, si) => {
          const v = d.values[si] ?? 0;
          if (v >= 0) pos += v;
          else neg += v;
        });
        if (pos > max) max = pos;
        if (neg < min) min = neg;
      }
      return [min, max];
    }
    const all = data.flatMap((d) => resolvedSeries.map((_s, si) => d.values[si] ?? 0));
    return extent(all);
  });

  const nice = $derived(niceScale(domain[0], domain[1], 5, true));

  interface BarRect {
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    value: number;
    datumIndex: number;
    seriesIndex: number;
    label: string;
    seriesLabel: string;
  }

  // Pure layout — called inside the ChartFrame snippet where the measured plot
  // dimensions are available.
  function computeBars(innerWidth: number, innerHeight: number): BarRect[] {
    const bands = bandScale(data.length, [0, innerWidth], 0.25);
    const y = linearScale([nice.min, nice.max], [innerHeight, 0]);
    const zeroY = y(0);
    const rects: BarRect[] = [];

    data.forEach((datum, di) => {
      const bandX = bands.position(di);
      if (stacked) {
        let posAcc = 0;
        let negAcc = 0;
        resolvedSeries.forEach((s, si) => {
          const v = datum.values[si] ?? 0;
          const base = v >= 0 ? posAcc : negAcc;
          const top = base + v;
          const yTop = y(Math.max(base, top));
          const yBottom = y(Math.min(base, top));
          rects.push({
            x: bandX,
            y: yTop,
            width: bands.bandwidth,
            height: Math.max(0, yBottom - yTop),
            color: seriesColor(si, s.color),
            value: v,
            datumIndex: di,
            seriesIndex: si,
            label: datum.label,
            seriesLabel: s.label
          });
          if (v >= 0) posAcc = top;
          else negAcc = top;
        });
      } else {
        const inner = bandScale(resolvedSeries.length, [bandX, bandX + bands.bandwidth], 0.1);
        resolvedSeries.forEach((s, si) => {
          const v = datum.values[si] ?? 0;
          const yv = y(v);
          rects.push({
            x: inner.position(si),
            y: Math.min(zeroY, yv),
            width: inner.bandwidth,
            height: Math.abs(yv - zeroY),
            color: seriesColor(si, s.color),
            value: v,
            datumIndex: di,
            seriesIndex: si,
            label: datum.label,
            seriesLabel: s.label
          });
        });
      }
    });
    return rects;
  }

  const resolvedAriaLabel = $derived(
    ariaLabel ??
      `Bar chart: ${data.length} ${data.length === 1 ? 'category' : 'categories'}` +
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
    {@const bands = bandScale(data.length, [0, plot.innerWidth], 0.25)}
    {@const bars = computeBars(plot.innerWidth, plot.innerHeight)}

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
      <line class={slot('axisLine')} x1="0" x2={plot.innerWidth} y1={yScale(0)} y2={yScale(0)} />
    </g>

    <!-- category axis -->
    <g class={slot('axis')} aria-hidden="true">
      {#each data as datum, i (datum.label + ' ' + i)}
        <text
          x={bands.center(i)}
          y={plot.innerHeight + 16}
          text-anchor="middle"
          class={slot('axisLabel')}
        >
          {datum.label}
        </text>
      {/each}
    </g>

    <!-- bars -->
    <g>
      {#each bars as bar (bar.datumIndex + ':' + bar.seriesIndex)}
        <rect
          class={slot('bar')}
          x={bar.x}
          y={bar.y}
          width={bar.width}
          height={bar.height}
          rx="1"
          fill={bar.color}
        >
          <title
            >{bar.seriesLabel ? `${bar.seriesLabel} — ` : ''}{bar.label}: {fmt(bar.value)}</title
          >
        </rect>
      {/each}
    </g>
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
