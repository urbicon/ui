<!--
  FormField-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { FormField } from '@urbicon-ui/blocks';
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
    pick: ['label', 'helper', 'error', 'required'],
    overrides: {
      label: { defaultValue: 'Document' },
      helper: { defaultValue: 'PDF, JPG, PNG — max 10 MB' },
      error: { defaultValue: '' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="FormField"
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
    <!-- Deckel ohne `mx-auto` — die Ausrichtung gehört der Bühne. -->
    <div class="w-full max-w-md">
      <FormField {...values}>
        {#snippet children(ctx)}
          <input
            id={ctx.id}
            type="file"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid || undefined}
            required={ctx.required}
            class="border-border-subtle w-full rounded-md border px-3 py-2 text-sm"
          />
        {/snippet}
      </FormField>
    </div>
  {/snippet}
</PlaygroundConfigurator>
