<!--
  CopyButton-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `#lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '#lib/playground-host.js';
  import { CopyButton } from '@urbicon-ui/blocks';
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
    pick: ['value', 'label', 'size', 'variant', 'intent', 'tier', 'disabled'],
    overrides: {
      value: { defaultValue: 'npm i @urbicon-ui/blocks' },
      label: { defaultValue: '' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="CopyButton"
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
    <CopyButton
      value={typeof values.value === 'string' ? values.value : ''}
      label={values.label || undefined}
      variant={values.variant}
      intent={values.intent}
      size={values.size}
      tier={values.tier}
      disabled={values.disabled}
    />
  {/snippet}
</PlaygroundConfigurator>
