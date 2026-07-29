<!--
  Button-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const controls = deriveControls(componentData, {
    pick: [
      'variant',
      'intent',
      'size',
      'tier',
      'loadingPlacement',
      'loading',
      'disabled',
      'mint',
      'children'
    ],
    overrides: {
      mint: {
        type: 'dropdown',
        label: 'Mint',
        items: [
          { label: 'none', value: 'none' },
          { label: 'scale', value: 'scale' },
          { label: 'ripple', value: 'ripple' },
          { label: 'bounce', value: 'bounce' },
          { label: 'glow', value: 'glow' }
        ],
        defaultValue: 'scale'
      },
      children: { type: 'text', label: 'Label', defaultValue: 'Get Started' },
      intent: { defaultValue: 'primary' },
      size: { defaultValue: 'lg' },
      loadingPlacement: { label: 'Loading Placement', defaultValue: 'overlay' },
      loading: { type: 'checkbox', defaultValue: false }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Button"
  source={playgroundSource}
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
    <Button {...values}>{values.children}</Button>
  {/snippet}
</PlaygroundConfigurator>
