<!--
  Badge-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Badge } from '@urbicon-ui/blocks';
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
      'variant',
      'intent',
      'size',
      'tier',
      'counter',
      'pulse',
      'removable',
      'interactive',
      'disabled',
      'children'
    ],
    // `border` is deliberately NOT a knob here. It is not a border but a
    // cut-out ring in the page's own colour (`ring-2 ring-surface-base`),
    // meant to lift a badge OFF a carrier — a counter on a button, a status
    // dot on an avatar. A free-standing badge has nothing to be lifted from,
    // so the knob reads as broken. Measured on a tinted stage too (2026-07-28):
    // the ring renders (`box-shadow: rgb(251,250,246) 0 0 0 2px`) but stays
    // invisible, because its colour follows the page, not the stage. The
    // carrier case belongs on the doc page as an example, not here.
    overrides: {
      // Badge trägt seinen Text als `children`. Als Override statt `extra`,
      // weil es eben doch eine Prop ist — der Codegenerator macht daraus
      // `<Badge>New</Badge>` statt eines erfundenen `label`-Attributs.
      children: { type: 'text', label: 'Label', defaultValue: 'New' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Badge"
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
    {@const { children: label, ...rest } = values}
    {#if rest.variant === 'dot'}
      {@const { counter: _c, removable: _r, interactive: _i, ...dotProps } = rest}
      <Badge {...dotProps} />
    {:else}
      <Badge {...rest}>{label}</Badge>
    {/if}
  {/snippet}
</PlaygroundConfigurator>
