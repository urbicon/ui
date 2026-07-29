<!--
  Tooltip-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Button, Tooltip } from '@urbicon-ui/blocks';
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
    pick: ['label', 'placement', 'intent', 'size', 'showDelay', 'hideDelay', 'arrow', 'disabled'],
    overrides: {
      label: { defaultValue: 'Helpful hint' },
      // `Placement` ist `Side | `${Side}-${Alignment}`` — ein Template-Literal,
      // aus dem sich keine Werte lesen lassen. Dieselbe kuratierte Auswahl wie
      // im Popover-Playground: die vier Seiten plus die Ausrichtungen, die man
      // an einem Tooltip auch wirklich unterscheiden kann.
      placement: {
        type: 'dropdown',
        items: [
          { label: 'top', value: 'top' },
          { label: 'top-start', value: 'top-start' },
          { label: 'top-end', value: 'top-end' },
          { label: 'bottom', value: 'bottom' },
          { label: 'left', value: 'left' },
          { label: 'right', value: 'right' }
        ],
        defaultValue: 'top'
      },
      showDelay: { type: 'slider', label: 'Show Delay (ms)', min: 0, max: 1000, step: 50 },
      hideDelay: { type: 'slider', label: 'Hide Delay (ms)', min: 0, max: 500, step: 50 },
      arrow: { label: 'Show Arrow' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Tooltip"
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
    <Tooltip
      label={String(values.label ?? '')}
      placement={values.placement}
      intent={values.intent}
      size={values.size}
      showDelay={values.showDelay}
      hideDelay={values.hideDelay}
      arrow={values.arrow}
      disabled={values.disabled}
    >
      <Button variant="outlined" size="sm">Hover me</Button>
    </Tooltip>
  {/snippet}
</PlaygroundConfigurator>
