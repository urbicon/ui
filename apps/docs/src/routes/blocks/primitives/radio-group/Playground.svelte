<!--
  RadioGroup-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
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
    pick: ['orientation', 'disabled', 'required', 'variant', 'intent', 'size', 'error'],
    overrides: {
      variant: {
        type: 'dropdown',
        label: 'Variant',
        items: [
          { label: 'outlined', value: 'outlined' },
          { label: 'filled', value: 'filled' },
          { label: 'ghost', value: 'ghost' }
        ],
        defaultValue: 'outlined'
      },
      intent: {
        type: 'dropdown',
        label: 'Intent',
        items: [
          { label: 'primary', value: 'primary' },
          { label: 'secondary', value: 'secondary' },
          { label: 'success', value: 'success' },
          { label: 'warning', value: 'warning' },
          { label: 'danger', value: 'danger' },
          { label: 'neutral', value: 'neutral' }
        ],
        defaultValue: 'primary'
      },
      size: {
        type: 'dropdown',
        label: 'Size',
        items: [
          { label: 'xs', value: 'xs' },
          { label: 'sm', value: 'sm' },
          { label: 'md', value: 'md' },
          { label: 'lg', value: 'lg' }
        ],
        defaultValue: 'md'
      }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="RadioGroup"
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
    <RadioGroup
      label="Notification preference"
      variant={values.variant}
      intent={values.intent}
      size={values.size}
      orientation={values.orientation}
      disabled={values.disabled}
      required={values.required}
    >
      <RadioItem value="all" label="All notifications" />
      <RadioItem value="mentions" label="Mentions only" />
      <RadioItem value="none" label="None" />
    </RadioGroup>
  {/snippet}
</PlaygroundConfigurator>
