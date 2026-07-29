<!--
  Avatar-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Avatar } from '@urbicon-ui/blocks';
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
      'name',
      'variant',
      'size',
      'intent',
      'status',
      'statusPosition',
      'pulse',
      'ring',
      'ringIntent',
      'randomColor',
      'interactive'
    ],
    overrides: {
      name: { defaultValue: 'Jane Doe' },
      variant: { label: 'Shape' },
      size: { defaultValue: 'lg' },
      status: {
        items: [
          { label: '(none)', value: '' },
          { label: 'online', value: 'online' },
          { label: 'offline', value: 'offline' },
          { label: 'busy', value: 'busy' },
          { label: 'away', value: 'away' }
        ],
        defaultValue: ''
      },
      statusPosition: { label: 'Status Position' },
      ringIntent: { label: 'Ring Intent' },
      randomColor: { label: 'Random Color' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Avatar"
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
    <Avatar {...values} status={values.status || undefined} />
  {/snippet}
</PlaygroundConfigurator>
