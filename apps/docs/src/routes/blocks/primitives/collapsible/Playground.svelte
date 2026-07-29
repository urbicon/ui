<!--
  Collapsible-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Collapsible } from '@urbicon-ui/blocks';
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
    pick: ['variant', 'size', 'defaultOpen', 'disabled']
  });
</script>

<PlaygroundConfigurator
  componentName="Collapsible"
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
    <div class="w-full max-w-lg">
      <Collapsible
        variant={values.variant}
        size={values.size}
        defaultOpen={values.defaultOpen}
        disabled={values.disabled}
        title="What are design tokens?"
      >
        <p class="text-text-secondary text-sm">
          Design tokens are named values — colors, spacing, radii — that form the single source of
          truth for your design system. They bridge the gap between design tools and code.
        </p>
      </Collapsible>
    </div>
  {/snippet}
</PlaygroundConfigurator>
