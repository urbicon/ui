<!--
  Checkbox-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Checkbox } from '@urbicon-ui/blocks';
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
    pick: [
      'label',
      'variant',
      'intent',
      'size',
      'tier',
      'checked',
      'indeterminate',
      'disabled',
      'helper',
      'error',
      'mint'
    ],
    overrides: {
      mint: {
        type: 'dropdown',
        label: 'Mint',
        items: [
          { label: '(none)', value: 'none' },
          { label: 'scale', value: 'scale' },
          { label: 'glow', value: 'glow' },
          { label: 'bounce', value: 'bounce' }
        ],
        defaultValue: 'none'
      },
      label: { defaultValue: 'Accept terms' },
      helper: { label: 'Helper Text', defaultValue: 'Required for signup' },
      error: { label: 'Error Text', defaultValue: '' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Checkbox"
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
    <Checkbox {...values} />
  {/snippet}
</PlaygroundConfigurator>
