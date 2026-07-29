<!--
  Alert-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Alert } from '@urbicon-ui/blocks';
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
    pick: ['title', 'variant', 'intent', 'size', 'dismissible', 'children'],
    overrides: {
      title: { defaultValue: 'Heads up!' },
      // Der Fließtext des Alerts ist `children`, nicht eine `description`-Prop.
      // Unter dem echten Namen druckt der Codegenerator ihn als Tag-Inhalt.
      children: {
        type: 'text',
        label: 'Description',
        defaultValue: 'This is an alert with important information.'
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Alert"
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
    {@const { title, children: description, ...props } = values}
    <div class="w-full max-w-lg">
      <Alert {...props} {title}>
        {description}
      </Alert>
    </div>
  {/snippet}
</PlaygroundConfigurator>
