<!--
  CurrencyInput-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { CurrencyInput } from '@urbicon-ui/blocks';
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
    pick: ['label', 'locale', 'currency', 'symbolPosition'],
    overrides: {
      label: { defaultValue: 'Price' },
      locale: {
        type: 'dropdown',
        items: [
          { label: 'de-DE', value: 'de-DE' },
          { label: 'en-US', value: 'en-US' },
          { label: 'ja-JP', value: 'ja-JP' }
        ],
        defaultValue: 'de-DE'
      },
      currency: {
        type: 'dropdown',
        items: [
          { label: 'EUR', value: 'EUR' },
          { label: 'USD', value: 'USD' },
          { label: 'GBP', value: 'GBP' },
          { label: 'JPY', value: 'JPY' }
        ],
        defaultValue: 'EUR'
      },
      symbolPosition: { label: 'Symbol Position', defaultValue: 'suffix' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="CurrencyInput"
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
    <!-- Ein Betragsfeld über die volle Bühnenbreite (≈ 646 px im Hero) sieht
         nach Fehler aus. Deckel wie beim DatePicker; die Ausrichtung bleibt bei
         der Bühne, deshalb kein `mx-auto`. -->
    <div class="max-w-xs">
      <CurrencyInput {...values} value={1234_56} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
