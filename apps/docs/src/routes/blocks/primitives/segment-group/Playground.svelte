<!--
  SegmentGroup-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
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
    pick: ['variant', 'size', 'tier', 'fullWidth', 'disabled', 'mint'],
    overrides: {
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
      fullWidth: { label: 'Full Width' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="SegmentGroup"
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
    <SegmentGroup {...values} value="list" ariaLabel="View mode">
      <SegmentItem value="list">List</SegmentItem>
      <SegmentItem value="grid">Grid</SegmentItem>
      <SegmentItem value="board">Board</SegmentItem>
    </SegmentGroup>
  {/snippet}
</PlaygroundConfigurator>
