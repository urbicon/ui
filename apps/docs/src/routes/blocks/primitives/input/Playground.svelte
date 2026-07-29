<!--
  Input-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Input } from '@urbicon-ui/blocks';
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
    pick: [
      'label',
      'variant',
      'intent',
      'size',
      'tier',
      'clearable',
      'disabled',
      'readonly',
      'required',
      'helper',
      'error',
      'placeholder'
    ],
    overrides: {
      placeholder: { type: 'text', label: 'Placeholder', defaultValue: 'name@example.com' },
      label: { defaultValue: 'Email' },
      helper: { label: 'Helper Text', defaultValue: 'We will never share your email' },
      error: { label: 'Error Text', defaultValue: '' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Input"
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
    <!-- Deckel ohne `mx-auto`: Die Ausrichtung gehört der Bühne (die Doku-Seite
         zentriert, der Hero setzt linksbündig). `xs` ist die Breite, die
         Select, DatePicker, NumberInput und CurrencyInput schon tragen. -->
    <div class="w-full max-w-xs">
      <Input
        label={values.label || undefined}
        placeholder={values.placeholder || undefined}
        variant={values.variant}
        intent={values.intent}
        size={values.size}
        tier={values.tier}
        clearable={values.clearable}
        disabled={values.disabled}
        readonly={values.readonly}
        required={values.required}
        helper={values.helper || undefined}
        error={values.error || undefined}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
