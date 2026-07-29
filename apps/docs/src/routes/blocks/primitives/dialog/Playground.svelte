<!--
  Dialog-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { Dialog, Button } from '@urbicon-ui/blocks';
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

  let open = $state(false);

  const controls = deriveControls(componentData, {
    pick: [
      'title',
      'size',
      'placement',
      'intent',
      'hideCloseButton',
      'closeOnBackdropClick',
      'closeOnEscape'
    ],
    overrides: {
      // Starts WITH a title: the header is what `intent` tints, so an empty
      // default would leave that knob visibly dead (the failure mode the hero
      // review found nine times). Clearing the field still shows the
      // content-agnostic overlay below.
      title: { defaultValue: 'Delete project' },
      hideCloseButton: { label: 'Hide Close Button' },
      closeOnBackdropClick: { label: 'Close on Backdrop', defaultValue: true },
      closeOnEscape: { label: 'Close on Escape', defaultValue: true }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Dialog"
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
    imports: ["import { Dialog } from '@urbicon-ui/blocks';"],
    state: { open: open },
    bind: ['open'],
    twoWay: ['open']
  }}
>
  {#snippet children(values)}
    <Button onclick={() => (open = true)} intent="primary">Open Dialog</Button>
    <Dialog
      bind:open
      title={values.title || undefined}
      size={values.size}
      placement={values.placement}
      intent={values.intent}
      hideCloseButton={values.hideCloseButton}
      closeOnBackdropClick={values.closeOnBackdropClick}
      closeOnEscape={values.closeOnEscape}
    >
      <p class="text-text-secondary text-sm">
        {#if values.title}
          This is the dialog body. Structured layout with header, body, and footer.
        {:else}
          This is a content-agnostic overlay. Adjust the controls to see how size, placement, and
          dismissal behavior change.
        {/if}
      </p>
      {#if values.title}
        {#snippet footer()}
          <div class="flex justify-end gap-2">
            <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
            <Button onclick={() => (open = false)}>Confirm</Button>
          </div>
        {/snippet}
      {:else}
        <div class="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onclick={() => (open = false)}>Cancel</Button>
          <Button onclick={() => (open = false)}>Confirm</Button>
        </div>
      {/if}
    </Dialog>
  {/snippet}
</PlaygroundConfigurator>
