<!--
  Progress-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Progress } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let playgroundValue = $state(65);

  const controls = deriveControls(componentData, {
    pick: ['intent', 'size', 'shape', 'showValue', 'striped', 'animated', 'indeterminate'],
    overrides: {
      showValue: { label: 'Show Value', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Progress"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { Progress } from '@urbicon-ui/blocks';"],
    state: { value: playgroundValue },
    bind: ['value']
  }}
>
  {#snippet children(values)}
    <div class="w-full max-w-sm">
      <Progress
        value={playgroundValue}
        label="Upload progress"
        intent={values.intent}
        size={values.size}
        shape={values.shape}
        showValue={values.showValue}
        striped={values.striped}
        animated={values.animated}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
