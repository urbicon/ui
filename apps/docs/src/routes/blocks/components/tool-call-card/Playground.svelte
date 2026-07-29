<!--
  ToolCallCard-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  `bind:values` statt eines festen `codeSetup`: Der ganze Sinn dieses Panels ist
  der Zustandswechsel, und jeder Zustand hat eine andere Nutzlast (`output` vs.
  `errorMessage`). Ein statisch gedrucktes `toolCall` zeigte immer denselben —
  so druckt der Schnipsel den, den die Bühne gerade rendert.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  type ToolState = ChatToolCallPart['state'];

  function partFor(state: ToolState): ChatToolCallPart {
    const base = {
      type: 'tool-call' as const,
      id: 'get_weather-1',
      name: 'get_weather',
      input: { city: 'Berlin', unit: 'celsius' }
    };
    if (state === 'complete') {
      return { ...base, state, output: { temperature: 21, condition: 'Partly cloudy' } };
    }
    if (state === 'error') {
      return { ...base, state, errorMessage: 'Upstream timed out after 30s (ETIMEDOUT)' };
    }
    return { ...base, state };
  }

  const controls = deriveControls(componentData, {
    pick: [],
    extra: [
      {
        type: 'dropdown',
        key: 'state',
        label: 'State',
        items: [
          { label: 'pending', value: 'pending' },
          { label: 'running', value: 'running' },
          { label: 'complete', value: 'complete' },
          { label: 'error', value: 'error' }
        ],
        defaultValue: 'running'
      }
    ]
  });

  let values = $state<Record<string, unknown>>(defaultValuesOf(controls));

  const toolCall = $derived(partFor(String(values.state ?? 'running') as ToolState));
</script>

<PlaygroundConfigurator
  componentName="ToolCallCard"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  bind:values
  codeSetup={{
    imports: ["import { ToolCallCard } from '@urbicon-ui/blocks';"],
    consts: { toolCall },
    bind: ['toolCall']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto max-w-lg">
      {#key values.state}
        <ToolCallCard {toolCall} />
      {/key}
    </div>
  {/snippet}
</PlaygroundConfigurator>
