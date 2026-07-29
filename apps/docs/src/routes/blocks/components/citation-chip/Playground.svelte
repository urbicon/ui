<!--
  CitationChip-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { CitationChip, type CitationSource } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const DEMO_SOURCE: CitationSource = {
    id: '1',
    title: 'Attention Is All You Need',
    url: 'https://arxiv.org/abs/1706.03762',
    snippet:
      'We propose the Transformer, a network architecture based solely on attention mechanisms.'
  };

  const controls = deriveControls(componentData, {
    pick: ['citationStyle', 'index', 'openLabel'],
    overrides: {
      citationStyle: { label: 'Style' },
      index: { defaultValue: 1, min: 1, max: 99, step: 1 },
      openLabel: { defaultValue: 'Open source' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="CitationChip"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { CitationChip } from '@urbicon-ui/blocks';"],
    consts: { source: DEMO_SOURCE },
    bind: ['source']
  }}
>
  {#snippet children(values)}
    <div class="flex min-h-24 items-center justify-center">
      <CitationChip
        source={DEMO_SOURCE}
        index={(values.index as number) || undefined}
        citationStyle={values.citationStyle as 'numeric' | 'label'}
        openLabel={(values.openLabel as string) || undefined}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
