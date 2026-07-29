<!--
  Skeleton-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Skeleton } from '@urbicon-ui/blocks';
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
    pick: ['variant', 'size', 'animation', 'width', 'height', 'count'],
    overrides: {
      // Platzhalter statt leerem Feld: „200" ist die naheliegendste Eingabe und
      // die einzige, die nicht wirken kann — `width:200` ist ungültiges CSS, das
      // der Browser stillschweigend verwirft. Die Komponente warnt darüber im
      // Dev-Build; hier steht die Einheit gleich im Feld.
      width: { defaultValue: '', placeholder: '200px · 50% · 12rem' },
      height: { defaultValue: '', placeholder: '1rem · 40px' },
      count: {
        type: 'dropdown',
        items: [
          { label: '1', value: '1' },
          { label: '2', value: '2' },
          { label: '3', value: '3' },
          { label: '5', value: '5' }
        ],
        defaultValue: '1'
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Skeleton"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
>
  {#snippet children(values: Record<string, unknown>)}
    {@const { width, height, count, ...props } = values}
    <Skeleton
      {...props}
      width={(width as string | undefined) || undefined}
      height={(height as string | undefined) || undefined}
      count={Number(count) || 1}
    />
  {/snippet}
</PlaygroundConfigurator>
