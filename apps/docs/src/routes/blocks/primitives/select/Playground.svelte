<!--
  Select-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Select } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  // Benannt statt inline im Markup: `codeSetup.consts` druckt die Liste damit
  // in den Schnipsel — inline wäre sie nur in der Vorschau zu sehen.
  const options = [
    { label: 'Svelte', value: 'svelte' },
    { label: 'React', value: 'react' },
    { label: 'Vue', value: 'vue' },
    { label: 'Angular', value: 'angular' }
  ];

  const controls = deriveControls(componentData, {
    pick: ['variant', 'size', 'tier', 'clearable', 'disabled', 'required', 'label', 'placeholder'],
    // `clearable` startet an, obwohl die Komponente auf `false` steht: Ohne das
    // sitzt ein Besucher nach der ersten Wahl in ihr fest (ein Single-Select
    // kennt kein Abwählen) und sieht die Ausstiegs-Fähigkeit nie. Der
    // Komponenten-Default bleibt `false` — richtig für Pflichtfelder.
    overrides: {
      clearable: { defaultValue: true },
      label: { type: 'text', defaultValue: 'Framework' },
      placeholder: { type: 'text', defaultValue: 'Choose a framework' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Select"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Select } from '@urbicon-ui/blocks';"],
    consts: { options },
    bind: ['options']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-xs">
      <Select
        label={String(values.label ?? '')}
        placeholder={String(values.placeholder ?? '')}
        {options}
        variant={values.variant}
        size={values.size}
        tier={values.tier}
        clearable={values.clearable}
        disabled={values.disabled}
        required={values.required}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
