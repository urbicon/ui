<!--
  AreaChart-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { AreaChart, type CartesianDatum, type ChartSeries } from '@urbicon-ui/blocks';
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
    { label: 'Jan', values: [4, 6] },
    { label: 'Feb', values: [7, 3] },
    { label: 'Mar', values: [5, 8] },
    { label: 'Apr', values: [9, 5] },
    { label: 'May', values: [12, 7] },
    { label: 'Jun', values: [10, 9] }
  ];

  const playgroundSeries: ChartSeries[] = [{ label: 'New' }, { label: 'Returning' }];

  const controls = deriveControls(componentData, {
    pick: ['stacked', 'showLegend', 'showGrid', 'fillOpacity', 'height'],
    overrides: {
      stacked: { type: 'boolean' },
      showLegend: { type: 'boolean', defaultValue: true },
      showGrid: { type: 'boolean', defaultValue: true },
      fillOpacity: { defaultValue: 0.2, min: 0, max: 1, step: 0.05 },
      height: { label: 'Height (px)', defaultValue: 260, min: 120, max: 480, step: 20 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="AreaChart"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { AreaChart } from '@urbicon-ui/blocks';"],
    consts: { data: playgroundData, series: playgroundSeries },
    bind: ['data', 'series']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-2xl">
      <AreaChart {...values} data={playgroundData} series={playgroundSeries} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
