<!--
  Separator-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Separator } from '@urbicon-ui/blocks';
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
    pick: ['orientation', 'size', 'decorative'],
    overrides: {
      decorative: { defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Separator"
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
    {#if values.orientation === 'vertical'}
      <div class="flex h-24 items-center gap-4">
        <span class="text-text-secondary text-sm">Left</span>
        <Separator {...values} />
        <span class="text-text-secondary text-sm">Right</span>
      </div>
    {:else}
      <div class="w-full max-w-md">
        <p class="text-text-secondary text-sm">Content above</p>
        <Separator {...values} />
        <p class="text-text-secondary text-sm">Content below</p>
      </div>
    {/if}
  {/snippet}
</PlaygroundConfigurator>
