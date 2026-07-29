<!--
  BarChart-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import { SET_FAMILIES } from '$lib/landing/set-facts';
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { BarChart, type BarChartDatum, type ChartSeries } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // This library by family — real counts, guarded by `set-facts.test.ts`. Two
  // series so `stacked` has something to say: stacked reads as family size,
  // grouped as how much of each is still moving. It also gives the demo more
  // categories than a tidy Q1–Q4, which is what a real chart has to survive.
  const playgroundData: BarChartDatum[] = SET_FAMILIES.map((f) => ({
    label: f.family,
    values: [f.settled, f.inProgress]
  }));

  const playgroundSeries: ChartSeries[] = [{ label: 'Settled' }, { label: 'In progress' }];

  const controls = deriveControls(componentData, {
    pick: ['stacked', 'showLegend', 'showGrid', 'height'],
    overrides: {
      stacked: { type: 'boolean' },
      showLegend: { type: 'boolean', defaultValue: true },
      showGrid: { type: 'boolean', defaultValue: true },
      height: { label: 'Height (px)', defaultValue: 260, min: 120, max: 480, step: 20 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="BarChart"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { BarChart } from '@urbicon-ui/blocks';"],
    consts: { data: playgroundData, series: playgroundSeries },
    bind: ['data', 'series']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-2xl">
      <BarChart {...values} data={playgroundData} series={playgroundSeries} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
