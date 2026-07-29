<!--
  ChartFrame-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ChartFrame } from '@urbicon-ui/blocks';
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

  const demo = [12, 18, 14, 22, 19, 26, 24];

  const controls = deriveControls(componentData, {
    pick: ['height'],
    overrides: {
      height: { defaultValue: 200, min: 120, max: 360, step: 20 }
    },
    extra: [
      {
        type: 'number',
        key: 'marginLeft',
        label: 'Margin left',
        defaultValue: 40,
        min: 0,
        max: 80,
        step: 4
      },
      {
        type: 'number',
        key: 'marginBottom',
        label: 'Margin bottom',
        defaultValue: 28,
        min: 0,
        max: 60,
        step: 4
      }
    ]
  });
</script>

<PlaygroundConfigurator
  componentName="ChartFrame"
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
    imports: ["import { ChartFrame } from '@urbicon-ui/blocks';"],
    consts: { demo }
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-xl">
      <ChartFrame
        height={values.height}
        margin={{ left: values.marginLeft, bottom: values.marginBottom }}
        ariaLabel="Weekly values"
      >
        {#snippet children({ innerWidth, innerHeight })}
          {@const max = Math.max(...demo)}
          {@const pts = demo.map((v, i) => ({
            x: (i / (demo.length - 1)) * innerWidth,
            y: innerHeight - (v / max) * innerHeight
          }))}
          <!-- value axis + baseline make the margins visible -->
          <line x1="0" y1="0" x2="0" y2={innerHeight} class="stroke-border-subtle" />
          <line
            x1="0"
            y1={innerHeight}
            x2={innerWidth}
            y2={innerHeight}
            class="stroke-border-default"
          />
          <polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            class="stroke-primary"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          {#each pts as p (p.x)}
            <circle cx={p.x} cy={p.y} r="3.5" class="fill-primary" />
          {/each}
        {/snippet}
      </ChartFrame>
    </div>
  {/snippet}
</PlaygroundConfigurator>
