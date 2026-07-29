<!--
  DonutChart-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import { SET_BY_MATURITY } from '$lib/landing/set-facts';
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { DonutChart, type DonutDatum } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // This library by maturity — real counts, guarded by `set-facts.test.ts`.
  // With `showTotal` on, the number in the middle is the size of the whole set,
  // which is the one figure the demo would otherwise have had to invent.
  const playgroundData: DonutDatum[] = [
    { label: 'stable', value: SET_BY_MATURITY.stable },
    { label: 'beta', value: SET_BY_MATURITY.beta },
    { label: 'experimental', value: SET_BY_MATURITY.experimental }
  ];

  const controls = deriveControls(componentData, {
    pick: ['showTotal', 'showLegend', 'innerRadiusRatio', 'padAngle', 'size'],
    overrides: {
      showTotal: { type: 'boolean', defaultValue: true },
      showLegend: { type: 'boolean', defaultValue: true },
      innerRadiusRatio: { label: 'Inner radius', defaultValue: 0.6, min: 0, max: 0.9, step: 0.05 },
      padAngle: { label: 'Pad angle (°)', defaultValue: 1, min: 0, max: 8, step: 0.5 },
      size: { label: 'Size (px)', defaultValue: 220, min: 120, max: 320, step: 10 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="DonutChart"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { DonutChart } from '@urbicon-ui/blocks';"],
    consts: { data: playgroundData },
    bind: ['data']
  }}
>
  {#snippet children(values)}
    <div class="flex w-full justify-center">
      <DonutChart {...values} data={playgroundData} totalLabel="Components" />
    </div>
  {/snippet}
</PlaygroundConfigurator>
