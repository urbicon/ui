<!--
  ButtonGroup-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button, ButtonGroup } from '@urbicon-ui/blocks';
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
      'orientation',
      'size',
      'tier',
      'selection',
      'connected',
      'disabled',
      'variant',
      'intent',
      'mint'
    ],
    overrides: {
      // `mint` ist vom Typ `MintProp`, den der Extractor nicht in Literale
      // auflösen kann — ohne diesen expliziten `type` wirft `deriveControls`
      // beim Rendern (und nimmt die ganze Seite mit). Gleiche Fassung wie bei
      // SegmentGroup und Tab, damit die drei denselben Regler zeigen.
      mint: {
        type: 'dropdown',
        label: 'Mint',
        items: [
          { label: 'none', value: 'none' },
          { label: 'scale', value: 'scale' },
          { label: 'glow', value: 'glow' },
          { label: 'pulse', value: 'pulse' },
          { label: 'wiggle', value: 'wiggle' }
        ],
        defaultValue: 'none'
      },
      variant: {
        type: 'dropdown',
        label: 'Variant',
        items: [
          { label: 'outlined', value: 'outlined' },
          { label: 'filled', value: 'filled' },
          { label: 'ghost', value: 'ghost' },
          { label: 'text', value: 'text' }
        ],
        defaultValue: 'outlined'
      },
      intent: {
        type: 'dropdown',
        label: 'Intent',
        items: [
          { label: 'neutral', value: 'neutral' },
          { label: 'primary', value: 'primary' },
          { label: 'secondary', value: 'secondary' },
          { label: 'success', value: 'success' },
          { label: 'warning', value: 'warning' },
          { label: 'danger', value: 'danger' }
        ],
        defaultValue: 'neutral'
      },
      size: { defaultValue: 'md' },
      selection: { defaultValue: 'single' },
      connected: { type: 'checkbox', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="ButtonGroup"
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
    <ButtonGroup {...values}>
      <Button value="left">Left</Button>
      <Button value="center">Center</Button>
      <Button value="right">Right</Button>
    </ButtonGroup>
  {/snippet}
</PlaygroundConfigurator>
