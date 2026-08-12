<!--
  Combobox-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Combobox } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const demoOptions = [
    { label: 'United States', value: 'us' },
    { label: 'United Kingdom', value: 'uk' },
    { label: 'Germany', value: 'de' },
    { label: 'France', value: 'fr' },
    { label: 'Japan', value: 'jp' },
    { label: 'Australia', value: 'au' },
    { label: 'Canada', value: 'ca' },
    { label: 'Brazil', value: 'br' }
  ];

  const controls = deriveControls(componentData, {
    pick: ['variant', 'size', 'tier', 'placeholder', 'noResultsText', 'clearable', 'disabled'],
    overrides: {
      placeholder: { defaultValue: 'Search countries…' },
      noResultsText: { label: 'No Results Text', defaultValue: 'No results found' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Combobox"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Combobox } from '@urbicon-ui/blocks';"],
    consts: { options: demoOptions },
    bind: ['options']
  }}
>
  {#snippet children(values)}
    <div class="w-64">
      <Combobox
        options={demoOptions}
        size={values.size}
        variant={values.variant}
        tier={values.tier}
        aria-label="Country"
        placeholder={values.placeholder || undefined}
        noResultsText={values.noResultsText || undefined}
        clearable={values.clearable}
        disabled={values.disabled}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
