<!--
  Spinner-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Spinner } from '@urbicon-ui/blocks';
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
    pick: ['label', 'variant', 'intent', 'size', 'speed', 'visible'],
    overrides: {
      // `label` ist der Barrierefreiheitstext (`aria-label` + ein `sr-only`-Span,
      // der auch bei `unstyled` sr-only bleibt). Der Regler schiebt also korrekt
      // etwas, das man nicht sehen soll — ohne den Zusatz liest er sich als tot.
      label: { label: 'Label (screen reader)', defaultValue: 'Loading...' },
      visible: { defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Spinner"
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
    {@const { label, ...props } = values}
    <Spinner {...props} label={label || 'Loading...'} />
  {/snippet}
</PlaygroundConfigurator>
