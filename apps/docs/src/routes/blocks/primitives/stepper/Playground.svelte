<!--
  Stepper-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Stepper, StepperStep } from '@urbicon-ui/blocks';
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
    pick: ['orientation', 'variant', 'size', 'tier', 'clickable', 'linear', 'disabled']
  });
</script>

<PlaygroundConfigurator
  componentName="Stepper"
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
    <div class="w-full max-w-xl">
      <Stepper
        activeStep={1}
        orientation={values.orientation}
        variant={values.variant}
        size={values.size}
        clickable={values.clickable}
        linear={values.linear}
        disabled={values.disabled}
      >
        <StepperStep label="Account" description="Create your account" />
        <StepperStep label="Profile" description="Set up your profile" />
        <StepperStep label="Review" description="Review and submit" />
      </Stepper>
    </div>
  {/snippet}
</PlaygroundConfigurator>
