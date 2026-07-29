<!--
  CompositionBar-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { CompositionBar, type CompositionItem } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const playgroundItems: CompositionItem[] = [
    { label: 'Anteil A', value: 60, intent: 'primary' },
    { label: 'Anteil B', value: 30, intent: 'success' },
    { label: 'Anteil C', value: 10, intent: 'warning' }
  ];

  const controls = deriveControls(componentData, {
    pick: ['orientation', 'size', 'legendPlacement', 'showLegend', 'showTotal', 'showPercentages'],
    overrides: {
      legendPlacement: {
        label: 'Legend',
        items: [
          { label: 'top', value: 'top' },
          { label: 'right', value: 'right' },
          { label: 'bottom', value: 'bottom' },
          { label: 'left', value: 'left' },
          { label: 'none', value: 'none' }
        ]
      },
      showLegend: { type: 'boolean', defaultValue: true },
      showTotal: { type: 'boolean' },
      showPercentages: { type: 'boolean', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="CompositionBar"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { CompositionBar } from '@urbicon-ui/blocks';"],
    consts: { items: playgroundItems },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-xl" style={values.orientation === 'vertical' ? 'height: 200px' : ''}>
      <CompositionBar {...values} items={playgroundItems} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
