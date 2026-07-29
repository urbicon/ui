<!--
  Drawer-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button, Drawer } from '@urbicon-ui/blocks';
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

  let playgroundOpen = $state(false);

  const controls = deriveControls(componentData, {
    // `accentEdge` steht direkt vor `intent`: Die Intent-Farbe erscheint nur
    // auf der Akzentkante (siehe die accentEdge×placement-Compounds in
    // `Drawer.variants.ts`), sonst wirkt der Intent-Regler folgenlos.
    pick: ['placement', 'size', 'accentEdge', 'intent', 'hideCloseButton'],
    overrides: {
      hideCloseButton: { label: 'Hide Close' },
      // Beide Startwerte weichen bewusst vom Komponenten-Default ab (der bleibt
      // als `componentDefault` im Schnipsel erhalten): `accentEdge` aus lässt
      // den Intent-Regler folgenlos, und `neutral` parkt ein Grau, das auf dem
      // weissen Panel neben der ohnehin vorhandenen Hairline nicht zu sehen ist.
      // Ab Werk führte das Feature sich damit selbst nicht vor.
      accentEdge: { label: 'Accent Edge', defaultValue: true },
      intent: { defaultValue: 'primary' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Drawer"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Drawer } from '@urbicon-ui/blocks';"],
    state: { open: playgroundOpen },
    bind: ['open'],
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <Button onclick={() => (playgroundOpen = true)}>Open Drawer</Button>
    <Drawer
      bind:open={playgroundOpen}
      title="Drawer Preview"
      placement={values.placement}
      size={values.size}
      accentEdge={values.accentEdge}
      intent={values.intent}
      hideCloseButton={values.hideCloseButton}
    >
      <p>This is the drawer content. Try changing the placement and size controls.</p>
    </Drawer>
  {/snippet}
</PlaygroundConfigurator>
