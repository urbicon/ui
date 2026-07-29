<!--
  Popover-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  Der Trigger benutzt `ChevronDownIcon` statt eines handgeschriebenen Pfades:
  Der Schnipsel darunter wird kopiert, und aus einer Bibliothek mit 315 eigenen
  Icons und einem Geometrie-Kontrakt (`docs/ICON-DESIGN.md`) fremde SVG-Pfade
  zu verteilen, wäre die eigene Vorschau gegen die eigene Regel. `codeSetup`
  trägt dafür die Import-Zeile — ohne sie zeigte der Schnipsel ein Icon, das
  nirgends herkommt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ChevronDownIcon, Popover } from '@urbicon-ui/blocks';
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
    pick: ['size', 'offsetDistance', 'syncWidth', 'placement'],
    overrides: {
      placement: {
        type: 'dropdown',
        label: 'Placement',
        items: [
          { label: 'top', value: 'top' },
          { label: 'top-start', value: 'top-start' },
          { label: 'top-end', value: 'top-end' },
          { label: 'bottom', value: 'bottom' },
          { label: 'bottom-start', value: 'bottom-start' },
          { label: 'bottom-end', value: 'bottom-end' },
          { label: 'left', value: 'left' },
          { label: 'right', value: 'right' }
        ],
        defaultValue: 'bottom-start'
      },
      offsetDistance: {
        type: 'slider',
        label: 'Offset',
        defaultValue: 4,
        min: 0,
        max: 24,
        step: 2
      },
      syncWidth: { label: 'Sync Width' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Popover"
  source={playgroundSource}
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { ChevronDownIcon, Popover } from '@urbicon-ui/blocks';"]
  }}
>
  {#snippet children(values)}
    <Popover
      placement={values.placement}
      size={values.size}
      offsetDistance={values.offsetDistance}
      syncWidth={values.syncWidth}
    >
      {#snippet trigger()}
        <div
          class="bg-surface-base border-border-default hover:border-border-emphasis flex w-80 cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors"
        >
          <span class="text-text-secondary">Choose an option…</span>
          <ChevronDownIcon class="text-text-tertiary h-4 w-4" />
        </div>
      {/snippet}

      <div class="divide-border-subtle divide-y">
        {#each ['Design tokens', 'Component variants', 'Documentation'] as option (option)}
          <div
            class="text-text-primary hover:bg-surface-hover cursor-pointer px-3 py-2 transition-colors first:rounded-t-md last:rounded-b-md"
          >
            {option}
          </div>
        {/each}
      </div>
    </Popover>
  {/snippet}
</PlaygroundConfigurator>
