<!--
  SplitPane-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { SplitPane } from '@urbicon-ui/blocks';
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
    pick: ['orientation', 'collapsible', 'disabled']
  });
</script>

<PlaygroundConfigurator
  componentName="SplitPane"
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
    <div class="border-border-subtle h-80 w-full overflow-hidden rounded-xl border">
      <SplitPane
        orientation={values.orientation as 'horizontal' | 'vertical'}
        collapsible={values.collapsible as boolean}
        disabled={values.disabled as boolean}
        defaultRatio={0.4}
        min="20%"
        max="80%"
      >
        {#snippet start()}
          <div class="bg-surface-elevated flex h-full items-center justify-center p-4">
            <span class="text-text-secondary text-sm font-medium">Start pane</span>
          </div>
        {/snippet}
        {#snippet end()}
          <div class="flex h-full items-center justify-center p-4">
            <span class="text-text-secondary text-sm font-medium">End pane</span>
          </div>
        {/snippet}
      </SplitPane>
    </div>
  {/snippet}
</PlaygroundConfigurator>
