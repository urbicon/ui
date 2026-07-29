<!--
  ReasoningDisclosure-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  `bind:values` statt eines festen `codeSetup`: Das `reasoning`-Objekt hängt am
  „Duration"-Regler, ein statisch gedrucktes würde also driften, sobald jemand
  ihn anfasst. So druckt der Schnipsel genau das Objekt, das die Bühne rendert.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  const sampleText = `The user wants a range, not a single date.

- \`DatePicker\` binds one \`Date\`; the range preset keeps one popover for both bounds.
- I'll point them at \`mode="range"\` and the \`onValueChange\` shape.`;

  const controls = deriveControls(componentData, {
    pick: ['streaming'],
    extra: [
      {
        type: 'number',
        key: 'durationMs',
        label: 'Duration (ms)',
        min: 0,
        max: 60000,
        step: 100,
        defaultValue: 4200
      }
    ]
  });

  let values = $state<Record<string, unknown>>(defaultValuesOf(controls));

  function reasoningFor(durationMs: number): ChatReasoningPart {
    return {
      type: 'reasoning',
      text: sampleText,
      durationMs: durationMs > 0 ? durationMs : undefined
    };
  }

  const reasoning = $derived(reasoningFor(Number(values.durationMs ?? 0)));
</script>

<PlaygroundConfigurator
  componentName="ReasoningDisclosure"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  bind:values
  codeSetup={{
    imports: ["import { ReasoningDisclosure } from '@urbicon-ui/blocks';"],
    consts: { reasoning },
    bind: ['reasoning']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto max-w-lg">
      <ReasoningDisclosure {reasoning} streaming={Boolean(values.streaming)} />
    </div>
  {/snippet}
</PlaygroundConfigurator>
