<!--
  CopyButton-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
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
    // intent/tier/disabled/variant reach the underlying Button through
    // `Pick<ButtonProps, …>`; docs-gen resolves the members since 2026-07-30,
    // so type, label and option list all derive.
    pick: ['value', 'label', 'size', 'variant', 'intent', 'tier', 'disabled'],
    overrides: {
      // `variant`/`intent` are set in CopyButton.svelte rather than as a prop
      // `@default`, so the extractor cannot see them and the derived default
      // would be `values[0]` (filled / primary).
      variant: { defaultValue: 'ghost' },
      intent: { defaultValue: 'neutral' },
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
