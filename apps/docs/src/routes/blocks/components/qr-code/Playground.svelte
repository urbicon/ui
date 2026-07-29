<!--
  QRCode-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { QRCode } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const controls = deriveControls(componentData, {
    pick: ['value', 'errorCorrection', 'size', 'frame'],
    overrides: {
      frame: {
        type: 'dropdown',
        label: 'Frame',
        items: [
          { label: 'none', value: 'none' },
          { label: 'card', value: 'card' }
        ],
        defaultValue: 'card'
      },
      value: { defaultValue: 'https://ui.urbicon.de' },
      errorCorrection: { defaultValue: 'M' },
      size: {
        type: 'dropdown',
        items: [
          { label: '120', value: 120 },
          { label: '160', value: 160 },
          { label: '200', value: 200 },
          { label: '240', value: 240 }
        ],
        defaultValue: 160
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="QRCode"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values)}
    <!-- `value` is spread from the playground state, but restated explicitly so
         its required-prop type is satisfied (the spread is an index signature). -->
    <QRCode {...values} value={typeof values.value === 'string' ? values.value : ''} />
  {/snippet}
</PlaygroundConfigurator>
