<!--
  Textarea-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Textarea } from '@urbicon-ui/blocks';
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
      'size',
      'tier',
      'intent',
      'autoResize',
      'showCounter',
      'disabled',
      'readonly',
      'required',
      'variant'
    ],
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
      autoResize: { label: 'Auto Resize' },
      showCounter: { label: 'Show Counter' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Textarea"
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
    <!-- Eine Stufe breiter als die einzeiligen Felder: Eine Textarea auf
         `max-w-xs` liest sich wie ein Eingabefehler. -->
    <div class="w-full max-w-md">
      <Textarea
        label="Description"
        placeholder="Tell us about your project..."
        variant={values.variant}
        size={values.size}
        tier={values.tier}
        intent={values.intent}
        autoResize={values.autoResize}
        showCounter={values.showCounter}
        maxlength={values.showCounter ? 280 : undefined}
        disabled={values.disabled}
        readonly={values.readonly}
        required={values.required}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
