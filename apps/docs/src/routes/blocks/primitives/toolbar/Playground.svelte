<!--
  Toolbar-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button, Separator, Toolbar } from '@urbicon-ui/blocks';
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
    pick: ['aria-label', 'variant', 'orientation', 'gap', 'padding', 'tier', 'unstyled'],
    overrides: {
      'aria-label': { label: 'ARIA Label', defaultValue: 'Formatting toolbar' },
      tier: { label: 'Tier (propagated)', defaultValue: 'modify' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Toolbar"
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
    <Toolbar
      aria-label={values['aria-label']}
      variant={values.variant}
      orientation={values.orientation}
      gap={values.gap}
      padding={values.padding}
      tier={values.tier}
      unstyled={values.unstyled}
    >
      <Button variant="ghost" size="sm" class="font-bold">B</Button>
      <Button variant="ghost" size="sm" class="italic">I</Button>
      <Button variant="ghost" size="sm" class="underline">U</Button>
      <Separator orientation="vertical" size="sm" />
      <Button variant="ghost" size="sm">⇤</Button>
      <Button variant="ghost" size="sm">≡</Button>
      <Button variant="ghost" size="sm">⇥</Button>
      <Separator orientation="vertical" size="sm" />
      <Button variant="ghost" size="sm">🔗</Button>
      <Button variant="ghost" size="sm">📷</Button>
    </Toolbar>
  {/snippet}
</PlaygroundConfigurator>
