<!--
  FormField-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { FormField, Input } from '@urbicon-ui/blocks';
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
          <!--
            Das Kind ist ein `<Input>`, kein rohes `<input>`: FormField reicht
            `id`/`describedBy`/`invalid`/`required` an ein *beliebiges* Control
            durch, und genau diesen Vertrag soll das Beispiel zeigen — aber im
            eigenen Vokabular. Vorher stand hier ein `<input type="file">` mit
            acht handgeschriebenen Tailwind-Klassen; wer den Schnipsel kopierte,
            kopierte eine Anleitung, an der Bibliothek vorbeizubauen (und
            ausgerechnet für den Fall, für den es `FileUpload` gibt).

            Kein eigenes `label` am Input: Das trägt der FormField, sonst steht
            es doppelt.
          -->
          <Input
            id={ctx.id}
            placeholder="Invoice 2026-07.pdf"
            aria-describedby={ctx.describedBy}
            aria-invalid={ctx.invalid}
            required={ctx.required}
          />
        {/snippet}
      </FormField>
    </div>
  {/snippet}
</PlaygroundConfigurator>
