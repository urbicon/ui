<!--
  Sparkline-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Sparkline } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const playgroundValues = [4, 6, 5, 8, 7, 10, 9, 12, 11, 14];

  const controls = deriveControls(componentData, {
    pick: ['area', 'showEndPoint', 'width', 'height', 'strokeWidth'],
    overrides: {
      area: { type: 'boolean', label: 'Area fill' },
      showEndPoint: { type: 'boolean', label: 'End point', defaultValue: true },
      width: { label: 'Width (px)', defaultValue: 160, min: 48, max: 320, step: 8 },
      height: { label: 'Height (px)', defaultValue: 40, min: 16, max: 96, step: 4 },
      strokeWidth: { label: 'Stroke', defaultValue: 1.5, min: 0.5, max: 4, step: 0.5 }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Sparkline"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Sparkline } from '@urbicon-ui/blocks';"],
    consts: { data: playgroundValues },
    bind: ['data']
  }}
>
  {#snippet children(values)}
    <div class="flex w-full justify-center p-6">
      <Sparkline {...values} data={playgroundValues} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
