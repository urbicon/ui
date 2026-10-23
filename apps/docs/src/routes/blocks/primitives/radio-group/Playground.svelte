<!--
  RadioGroup-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `#lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import type { PlaygroundHostProps } from '#lib/playground-host.js';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const controls = deriveControls(componentData, {
    pick: ['orientation', 'disabled', 'required', 'variant', 'intent', 'size', 'error']
  });
</script>

<PlaygroundConfigurator
  componentName="RadioGroup"
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
    <RadioGroup
      label="Notification preference"
      variant={values.variant}
      intent={values.intent}
      size={values.size}
      orientation={values.orientation}
      disabled={values.disabled}
      required={values.required}
      error={values.error || undefined}
    >
      <RadioItem value="all" label="All notifications" />
      <RadioItem value="mentions" label="Mentions only" />
      <RadioItem value="none" label="None" />
    </RadioGroup>
  {/snippet}
</PlaygroundConfigurator>
