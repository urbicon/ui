<!--
  Toggle-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Toggle } from '@urbicon-ui/blocks';
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
      'error',
      'withBorder',
      'disabled',
      'helper',
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
      label: { defaultValue: 'Enable notifications' },
      checked: { defaultValue: true },
      withBorder: { type: 'checkbox', label: 'With Border', defaultValue: false },
      helper: { label: 'Helper Text', defaultValue: 'Push updates instantly' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Toggle"
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
    <Toggle {...values} />
  {/snippet}
</PlaygroundConfigurator>
