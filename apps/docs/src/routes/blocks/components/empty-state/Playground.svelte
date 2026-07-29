<!--
  EmptyState-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { EmptyState, Button, InboxIcon, PlusIcon } from '@urbicon-ui/blocks';
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
    pick: ['title', 'description', 'density'],
    overrides: {
      title: { defaultValue: 'No items yet' },
      description: { defaultValue: 'Get started by adding the first item.' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="EmptyState"
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
    <EmptyState
      title={String(values.title ?? '')}
      description={values.description as string | undefined}
      density={values.density as 'compact' | 'default' | undefined}
      icon={InboxIcon}
    >
      {#snippet cta()}
        <Button intent="primary">
          <PlusIcon />
          Add item
        </Button>
      {/snippet}
    </EmptyState>
  {/snippet}
</PlaygroundConfigurator>
