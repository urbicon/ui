<!--
  PinInput-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { PinInput } from '@urbicon-ui/blocks';
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
    // `required` und `messageType` fehlen bewusst: Ersteres setzt ein Sternchen
    // ans Label, letzteres färbt eine Meldung — das Beispiel hat weder Label
    // noch Meldungstext, beide Regler blieben also folgenlos. `intent` fehlt,
    // weil es an der Feld-Familie nachweislich nichts färbt (technical-debt).
    pick: ['length', 'type', 'mask', 'size', 'variant', 'tier', 'intent', 'readonly', 'disabled'],
    overrides: {
      length: {
        type: 'dropdown',
        items: [
          { label: '4', value: 4 },
          { label: '6', value: 6 },
          { label: '8', value: 8 }
        ],
        defaultValue: 6
      },
      mask: { type: 'boolean' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="PinInput"
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
    <PinInput {...values} />
  {/snippet}
</PlaygroundConfigurator>
