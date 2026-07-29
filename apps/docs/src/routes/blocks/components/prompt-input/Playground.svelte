<!--
  PromptInput-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { PromptInput, type FileIntakeEntry } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let draft = $state('');

  let attachments = $state<FileIntakeEntry[]>([]);

  let log = $state<{ id: string; text: string }[]>([]);

  function record(payload: { text: string; attachments: FileIntakeEntry[] }) {
    const files = payload.attachments.map((a) => a.file.name);
    const suffix = files.length ? ` + [${files.join(', ')}]` : '';
    log = [
      { id: crypto.randomUUID(), text: `${payload.text || '(no text)'}${suffix}` },
      ...log
    ].slice(0, 5);
  }

  const controls = deriveControls(componentData, {
    pick: ['size', 'submitOn', 'busy', 'allowAttachments', 'disabled', 'placeholder'],
    overrides: {
      placeholder: { defaultValue: 'Type a message…' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="PromptInput"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { PromptInput } from '@urbicon-ui/blocks';"],
    state: { value: draft },
    bind: ['value'],
    twoWay: ['value']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto w-full max-w-xl space-y-4">
      <PromptInput
        bind:value={draft}
        bind:attachments
        submitOn={values.submitOn as 'enter' | 'mod-enter'}
        busy={values.busy as boolean}
        allowAttachments={values.allowAttachments as boolean}
        disabled={values.disabled as boolean}
        accept="image/*"
        placeholder={(values.placeholder as string) || undefined}
        onSubmit={record}
      />
      {#if log.length > 0}
        <div class="border-border-subtle rounded-xl border p-3">
          <p class="text-text-tertiary mb-2 text-xs font-semibold tracking-wide uppercase">
            onSubmit payloads
          </p>
          <ul class="space-y-1">
            {#each log as entry (entry.id)}
              <li class="text-text-secondary font-mono text-xs">{entry.text}</li>
            {/each}
          </ul>
        </div>
      {:else}
        <p class="text-text-tertiary text-center text-xs">
          Submitted messages appear here. With <em>Busy</em> on, the send button becomes a stop button
          and Enter no longer submits.
        </p>
      {/if}
    </div>
  {/snippet}
</PlaygroundConfigurator>
