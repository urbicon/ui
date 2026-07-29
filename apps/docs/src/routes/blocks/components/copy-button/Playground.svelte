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
    // intent/tier/disabled reach the underlying Button through
    // `Pick<ButtonProps, …>` — they were simply missing from the knob list.
    // Each needs a full override, exactly like `variant` already did: docs-gen
    // extracts the whole `Pick<…>` as a single prop named "...Pick" instead of
    // its members, so none of them is a derivable key (technical-debt).
    pick: ['value', 'label', 'size', 'variant', 'intent', 'tier', 'disabled'],
    overrides: {
      intent: {
        type: 'dropdown',
        label: 'Intent',
        items: [
          { label: 'neutral', value: 'neutral' },
          { label: 'primary', value: 'primary' },
          { label: 'secondary', value: 'secondary' },
          { label: 'success', value: 'success' },
          { label: 'warning', value: 'warning' },
          { label: 'danger', value: 'danger' }
        ],
        defaultValue: 'neutral'
      },
      tier: {
        type: 'dropdown',
        label: 'Tier',
        items: [
          { label: 'commit', value: 'commit' },
          { label: 'modify', value: 'modify' }
        ],
        defaultValue: 'commit'
      },
      disabled: { type: 'checkbox', label: 'Disabled', defaultValue: false },
      variant: {
        type: 'dropdown',
        label: 'Variant',
        items: [
          { label: 'ghost', value: 'ghost' },
          { label: 'outlined', value: 'outlined' },
          { label: 'filled', value: 'filled' },
          { label: 'text', value: 'text' }
        ],
        defaultValue: 'ghost'
      },
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
