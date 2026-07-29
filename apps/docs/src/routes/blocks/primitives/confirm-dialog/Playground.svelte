<!--
  ConfirmDialog-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ConfirmDialog, Button } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let demoOpen = $state(false);

  const controls = deriveControls(componentData, {
    pick: ['title', 'description', 'confirmLabel', 'cancelLabel', 'intent'],
    overrides: {
      intent: {
        type: 'dropdown',
        label: 'Intent',
        items: [
          { label: 'danger', value: 'danger' },
          { label: 'warning', value: 'warning' },
          { label: 'primary', value: 'primary' },
          { label: 'success', value: 'success' },
          { label: 'neutral', value: 'neutral' }
        ],
        defaultValue: 'danger'
      },
      title: { defaultValue: 'Delete project?' },
      description: { defaultValue: 'This cannot be undone.' },
      confirmLabel: { label: 'Confirm Label', defaultValue: 'Delete' },
      cancelLabel: { label: 'Cancel Label', defaultValue: 'Cancel' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="ConfirmDialog"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { ConfirmDialog } from '@urbicon-ui/blocks';"],
    state: { open: demoOpen },
    bind: ['open'],
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <Button intent={values.intent} onclick={() => (demoOpen = true)}>Open dialog</Button>
    <ConfirmDialog
      bind:open={demoOpen}
      title={String(values.title ?? '')}
      description={values.description as string | undefined}
      intent={values.intent}
      confirmLabel={values.confirmLabel as string | undefined}
      cancelLabel={values.cancelLabel as string | undefined}
      onConfirm={() => Promise.resolve()}
    />
  {/snippet}
</PlaygroundConfigurator>
