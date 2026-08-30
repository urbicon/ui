<script lang="ts">
  import { getBlocksConfig, resolveSlotClasses } from '$lib/provider';
  import { useBlocksI18n } from '$lib';
  import type { DonutChartProps } from './index';
  import { chartSlotResolver } from '$lib/internal/charts/variants';
  import { arcPath, seriesColor, numberFormatter } from '$lib/internal/charts/utils';

  let {
    data,
    size = 220,
    innerRadiusRatio = 0.6,
    padAngle = 0,
    formatValue,
    locale,
    showTotal = false,
    totalLabel,
    showLegend = true,
    ariaLabel,
    class: className,
    unstyled: unstyledProp = false,
    slotClasses: slotClassesProp = {},
    preset,
    ...rest
  }: DonutChartProps = $props();

  const blocksConfig = getBlocksConfig();
  const bt = useBlocksI18n();
  const unstyled = $derived(unstyledProp || blocksConfig?.unstyled || false);
  const slotClasses = $derived(
    resolveSlotClasses(blocksConfig, 'DonutChart', preset, {}, slotClassesProp)
  );
  const slot = $derived(chartSlotResolver(unstyled, slotClasses, { layout: 'donut' }));

  const fmt = $derived(formatValue ?? numberFormatter(locale));
  const pct = $derived(numberFormatter(locale, { style: 'percent', maximumFractionDigits: 0 }));
  const total = $derived(data.reduce((sum, d) => sum + Math.max(0, d.value), 0));

  const TAU = Math.PI * 2;
  const pad = $derived((padAngle * Math.PI) / 180);

  interface Segment {
    d: string;
    color: string;
    label: string;
    value: number;
    percent: number;
  }

  const segments = $derived.by<Segment[]>(() => {
    if (total <= 0) return [];
    const center = size / 2;
    const outer = size / 2;
    const inner = outer * Math.min(0.95, Math.max(0, innerRadiusRatio));
    const half = data.length > 1 ? pad / 2 : 0;
    let angle = 0;
    return data.map((d, i) => {
      const value = Math.max(0, d.value);
      const sweep = (value / total) * TAU;
      const start = angle + half;
      const end = angle + sweep - half;
      angle += sweep;
      return {
        d: end > start ? arcPath(center, center, outer, inner, start, end) : '',
        color: seriesColor(i, d.color),
        label: d.label,
        value,
        percent: value / total
      };
    });
  });

  const resolvedAriaLabel = $derived(
    ariaLabel ?? `Donut chart: ${data.length} segments, total ${fmt(total)}`
  );
</script>

<figure {...rest} class={slot('root', className)}>
  <svg
    class={slot('svg')}
    viewBox="0 0 {size} {size}"
    role="img"
    aria-label={resolvedAriaLabel}
    style="max-width: {size}px; height: auto;"
  >
    {#each segments as seg, i (seg.label + ' ' + i)}
      {#if seg.d}
        <path class={slot('arc')} d={seg.d} fill={seg.color}>
          <title>{seg.label}: {fmt(seg.value)} ({pct(seg.percent)})</title>
        </path>
      {/if}
    {/each}

    {#if showTotal && innerRadiusRatio > 0}
      <text
        x={size / 2}
        y={size / 2}
        text-anchor="middle"
        dy={totalLabel ? '-0.1em' : '0.32em'}
        class={slot('centerLabel')}
      >
        {fmt(total)}
      </text>
      {#if totalLabel}
        <text
          x={size / 2}
          y={size / 2}
          text-anchor="middle"
          dy="1.25em"
          class={slot('centerSubLabel')}
        >
          {totalLabel}
        </text>
      {/if}
    {/if}
  </svg>

  {#if showLegend}
    <ul class={slot('legend')}>
      {#each data as d, i (d.label + ' ' + i)}
        <li class={slot('legendItem')}>
          <span class={slot('legendSwatch')} style="background-color: {seriesColor(i, d.color)}"
          ></span>
          {d.label}
        </li>
      {/each}
    </ul>
  {/if}

  <div class="sr-only">
    <table>
      <caption>{resolvedAriaLabel}</caption>
      <thead>
        <tr>
          <th scope="col">{bt('chart.segment')}</th>
          <th scope="col">{bt('chart.value')}</th>
          <th scope="col">{bt('chart.share')}</th>
        </tr>
      </thead>
      <tbody>
        {#each data as d, i (d.label + ' ' + i)}
          <tr>
            <th scope="row">{d.label}</th>
            <td>{fmt(Math.max(0, d.value))}</td>
            <td>{total > 0 ? pct(Math.max(0, d.value) / total) : pct(0)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</figure>
