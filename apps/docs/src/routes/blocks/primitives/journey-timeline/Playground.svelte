<!--
  JourneyTimeline-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { JourneyTimeline, type JourneyNode } from '@urbicon-ui/blocks';
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

  const stages: JourneyNode[] = [
    {
      id: 'readings',
      title: 'Meter readings',
      status: 'complete',
      subtitle: 'All units collected',
      meta: '3 Jun',
      segmentLabel: '2 days · validation'
    },
    {
      id: 'validate',
      title: 'Validation',
      status: 'complete',
      subtitle: 'Anomalies resolved',
      meta: '5 Jun',
      connector: 'dashed',
      segmentLabel: 'manual review'
    },
    {
      id: 'statements',
      title: 'Statements',
      status: 'active',
      subtitle: 'Generating documents',
      meta: '6 Jun'
    },
    { id: 'dispatch', title: 'Dispatch', status: 'pending', subtitle: 'Email + postal' }
  ];

  const controls = deriveControls(componentData, {
    pick: ['orientation', 'detail', 'size']
  });
</script>

<PlaygroundConfigurator
  componentName="JourneyTimeline"
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
    imports: ["import { JourneyTimeline } from '@urbicon-ui/blocks';"],
    consts: { items: stages },
    bind: ['items']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-xl">
      <JourneyTimeline
        items={stages}
        orientation={values.orientation}
        detail={values.detail}
        size={values.size}
      >
        {#snippet node(item)}
          <p class="text-text-secondary text-sm">
            Full record for “{item.title}” renders here while the node is in focus.
          </p>
        {/snippet}
      </JourneyTimeline>
    </div>
  {/snippet}
</PlaygroundConfigurator>
