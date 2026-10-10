<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '#lib/provider/index.js';
  import type { AreaChartProps } from './index';
  import type { ChartSeries } from '#lib/internal/charts/types.js';
  import {
    type ChartVariants,
    chartSlotResolver,
    chartVariants
  } from '#lib/internal/charts/variants.js';
  import { resolveClassChain } from '#lib/utils/variants.js';
  import {
    linearScale,
    niceScale,
    linePath,
    areaPath,
    seriesColor,
    numberFormatter,
    extent
  } from '#lib/internal/charts/utils.js';
  import type { ChartPoint } from '#lib/internal/charts/utils.js';
  import ChartFrame from '../ChartFrame/ChartFrame.svelte';
  import { useBlocksI18n } from '#lib';

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
    // A plain aria-label names the chart as `ariaLabel` does. Left in rest it
    // would reach ChartFrame, which ranks it below the generated summary.
    'aria-label': restAriaLabel,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: AreaChartProps = $props();

  const blocksConfig = getBlocksConfig();
  const bt = useBlocksI18n();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  // Cartesian is the shape these charts render, and it is named rather than
  // left to the config default: the same value reaches the styling call and
  // the override cascade, so a rule keyed on the layout cannot see a shape
  // other than the one being painted.
  const variantProps: ChartVariants = { layout: 'cartesian' };
  const slotClasses = $derived(
    resolveSlotClasses(
      blocksConfig,
      'AreaChart',
      preset,
      variantProps,
      slotClassesProp,
      chartVariants.config
    )
  );
  const slot = $derived(chartSlotResolver(unstyled, slotClasses, variantProps));

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
  const opacity = $derived(fillOpacity ?? (stacked ? 0.85 : 0.2));

  // A zero — a missing value included — is a vertex of its band and its
  // outline, so it has to sit on the side its series is on there, or the
  // outline leaps to the other stack and back: the side of the nearest non-zero
  // value before it, else after it. Looking back first is a choice: it only
  // decides a zero between opposite signs, and puts that crossing after the zero.
  // A series of zeros stacks above.
  function stacksAbove(values: readonly number[], index: number): boolean {
    for (let i = index; i >= 0; i--) if (values[i] !== 0) return values[i] > 0;
    for (let i = index + 1; i < values.length; i++) if (values[i] !== 0) return values[i] > 0;
    return true;
  }

  // Per series and category, the band's `[base, outer]` in data units. A positive
  // value stacks on the running sum above zero and a negative one on the sum
  // below it, so at each category no band covers another's value.
  // Pixel-independent; the domain and the drawn bands both read it.
  const stack = $derived.by<(readonly [number, number])[][]>(() => {
    if (!stacked) return [];
    const above = data.map(() => 0);
    const below = data.map(() => 0);
    return resolvedSeries.map((_s, si) => {
      const values = data.map((d) => d.values[si] ?? 0);
      return values.map((value, i) => {
        const sums = stacksAbove(values, i) ? above : below;
        const base = sums[i];
        sums[i] += value;
        return [base, sums[i]] as const;
      });
    });
  });

  const domain = $derived.by<[number, number]>(() => {
    if (stacked) return extent(stack.flat(2));
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
      return resolvedSeries.map((s, si) => {
        const base: ChartPoint[] = stack[si].map(([from], i) => [xAt(i, innerWidth), y(from)]);
        const outer: ChartPoint[] = stack[si].map(([, to], i) => [xAt(i, innerWidth), y(to)]);
        // Closed polygon: outer edge forward, base back. linePath() applies
        // the shared coord() rounding so both edges format consistently.
        const ring: ChartPoint[] = [...outer, ...base.slice().reverse()];
        return {
          color: seriesColor(si, s.color),
          label: s.label,
          areaD: `${linePath(ring)}Z`,
          lineD: linePath(outer)
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
      restAriaLabel ??
      bt(stacked ? 'chart.stackedAreaSummary' : 'chart.areaSummary', {
        points: data.length,
        series: resolvedSeries.length
      })
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
        class={resolveClassChain(slot('mark'), slot('area'))}
        d={area.areaD}
        fill={area.color}
        fill-opacity={opacity}
        stroke="none"
      />
      <path
        class={resolveClassChain(slot('mark'), slot('areaOutline'))}
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
