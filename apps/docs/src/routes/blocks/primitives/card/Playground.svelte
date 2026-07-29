<!--
  Card-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Card, Button } from '@urbicon-ui/blocks';
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
    pick: ['variant', 'padding', 'dividers', 'clickable', 'disabled']
  });
</script>

<PlaygroundConfigurator
  componentName="Card"
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
    <div class="max-w-md">
      <Card
        variant={values.variant}
        padding={values.padding}
        dividers={values.dividers}
        clickable={values.clickable}
        disabled={values.disabled}
      >
        {#snippet header()}
          <div class="font-semibold">Card Title</div>
          <div class="text-text-tertiary text-xs">Optional subtitle</div>
        {/snippet}

        <div class="text-text-secondary text-sm">
          Cards group related content. Change variant and padding to see different looks.
        </div>

        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm">Cancel</Button>
            <Button variant="filled" intent="primary" size="sm">Confirm</Button>
          </div>
        {/snippet}
      </Card>
    </div>
  {/snippet}
</PlaygroundConfigurator>
