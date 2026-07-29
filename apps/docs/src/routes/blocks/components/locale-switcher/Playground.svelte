<!--
  LocaleSwitcher-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { LocaleSwitcher } from '@urbicon-ui/blocks';
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
    pick: ['showFlag', 'variant', 'size', 'disabled'],
    overrides: {
      variant: {
        type: 'dropdown',
        label: 'Variant',
        items: [
          { label: 'outlined', value: 'outlined' },
          { label: 'filled', value: 'filled' },
          { label: 'ghost', value: 'ghost' },
          { label: 'underline', value: 'underline' }
        ],
        defaultValue: 'outlined'
      },
      size: {
        type: 'dropdown',
        label: 'Size',
        items: [
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' }
        ],
        defaultValue: 'sm'
      },
      disabled: { type: 'checkbox', label: 'Disabled', defaultValue: false },
      showFlag: { label: 'Show Flag', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="LocaleSwitcher"
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
    <LocaleSwitcher {...values} />
  {/snippet}
</PlaygroundConfigurator>
