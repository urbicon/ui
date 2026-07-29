<!--
  LineChart-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { LineChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const playgroundData: CartesianDatum[] = [
    { label: 'Mon', values: [120, 80] },
    { label: 'Tue', values: [180, 96] },
    { label: 'Wed', values: [150, 110] },
    { label: 'Thu', values: [210, 130] },
    { label: 'Fri', values: [240, 160] },
    { label: 'Sat', values: [190, 140] },
    { label: 'Sun', values: [160, 120] }
  ];

  const playgroundSeries: ChartSeries[] = [{ label: 'Visitors' }, { label: 'Signups' }];

  const controls = deriveControls(componentData, {
    pick: ['showPoints', 'showLegend', 'showGrid', 'includeZero', 'height'],
    overrides: {
      showPoints: { type: 'boolean', defaultValue: true },
      showLegend: { type: 'boolean', defaultValue: true },
      showGrid: { type: 'boolean', defaultValue: true },
      includeZero: { type: 'boolean' },
      height: { label: 'Height (px)', defaultValue: 260, min: 120, max: 480, step: 20 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="LineChart"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { LineChart } from '@urbicon-ui/blocks';"],
    consts: { data: playgroundData, series: playgroundSeries },
    bind: ['data', 'series']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-2xl">
      <LineChart {...values} data={playgroundData} series={playgroundSeries} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
