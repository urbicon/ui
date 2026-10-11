<script module lang="ts">
  export type ThemeChildren = 'accordionItem' | 'radioItem' | 'stepperStep' | 'button' | 'tabItem';
</script>

<script lang="ts">
  import type { Component } from 'svelte';
  import AccordionItem from '#lib/primitives/Accordion/AccordionItem.svelte';
  import Button from '#lib/primitives/Button/Button.svelte';
  import RadioItem from '#lib/primitives/RadioGroup/RadioItem.svelte';
  import StepperStep from '#lib/primitives/Stepper/StepperStep.svelte';
  import TabItem from '#lib/primitives/Tab/TabItem.svelte';
  import BlocksProvider from '../BlocksProvider.svelte';
  import type { ComponentDefaults, PresetMap } from '../blocks-context';

  /**
   * A parent whose style props paint only the children it hands them to, with
   * one real child. The theme sweep's own mount gives a parent a plain `<span>`
   * for children, which carries none of what the parent passes down — so a
   * parent that forgot its theme would render that mount unchanged.
   */
  let {
    component,
    child: kind,
    props = {},
    config
  }: {
    component: Component<Record<string, unknown>>;
    child: ThemeChildren;
    props?: Record<string, unknown>;
    config: { defaults?: Record<string, ComponentDefaults>; presets?: PresetMap };
  } = $props();

  const Parent = $derived(component);
</script>

<BlocksProvider defaults={config.defaults ?? {}} presets={config.presets ?? {}}>
  {#if kind === 'tabItem'}
    <Parent {...props}>
      {#snippet tabs()}<TabItem value="a">A</TabItem>{/snippet}
    </Parent>
  {:else}
    <Parent {...props}>
      {#if kind === 'accordionItem'}
        <AccordionItem value="a" title="A">body</AccordionItem>
      {:else if kind === 'radioItem'}
        <RadioItem value="a" label="A" />
      {:else if kind === 'stepperStep'}
        <StepperStep label="One" />
        <StepperStep label="Two" />
      {:else}
        <Button>One</Button>
      {/if}
    </Parent>
  {/if}
</BlocksProvider>
