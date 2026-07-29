<!--
  TimeInput-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { TimeInput } from '@urbicon-ui/blocks';
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
    // Erscheinung zuerst, Zustände hinten. `messageType` fehlt bewusst: Es färbt
    // eine Meldung, und ohne `helper`/`error`-Text gäbe es nichts zu färben.
    // `intent` fehlt, weil es am Feldrahmen nachweislich nichts ändert — die
    // Klasse kommt an, eine konkurrierende border-Utility gewinnt
    // (gemessen, siehe docs/technical-debt.md). `required` fehlt, weil es sein
    // Sternchen an ein `<label>` hängt, das dieses Beispiel nicht rendert.
    pick: [
      'format',
      'withSeconds',
      'size',
      'variant',
      'tier',
      'intent',
      'showIcon',
      'fullWidth',
      'readonly',
      'disabled'
    ],
    overrides: {
      format: { defaultValue: '24h' },
      withSeconds: {
        type: 'dropdown',
        label: 'With Seconds',
        items: [
          { label: 'false', value: false },
          { label: 'true', value: true }
        ]
      },
      showIcon: {
        type: 'dropdown',
        label: 'Show Icon',
        items: [
          { label: 'true', value: true },
          { label: 'false', value: false }
        ],
        defaultValue: true
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="TimeInput"
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
    <TimeInput label="Time" {...values} />
  {/snippet}
</PlaygroundConfigurator>
