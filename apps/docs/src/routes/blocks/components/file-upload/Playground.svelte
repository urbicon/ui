<!--
  FileUpload-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  let playgroundFiles = $state<FileUploadFile[]>([]);

  const controls = deriveControls(componentData, {
    pick: ['size', 'intent', 'multiple', 'maxFiles', 'allowDrop', 'allowPaste', 'disabled'],
    overrides: {
      intent: { defaultValue: 'primary' },
      maxFiles: {
        label: 'Max Files',
        defaultValue: undefined,
        min: 0,
        max: 20,
        step: 1,
        placeholder: 'Unlimited'
      },
      allowDrop: { label: 'Allow Drop', defaultValue: true },
      allowPaste: { label: 'Allow Paste' },
      disabled: { type: 'checkbox', defaultValue: false }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="FileUpload"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: ["import { FileUpload } from '@urbicon-ui/blocks';"],
    state: { files: playgroundFiles },
    bind: ['files'],
    twoWay: ['files']
  }}
>
  {#snippet children(values)}
    <div class="mx-auto max-w-md">
      <FileUpload
        bind:files={playgroundFiles}
        size={values.size}
        intent={values.intent}
        multiple={values.multiple}
        maxFiles={values.maxFiles || undefined}
        allowDrop={values.allowDrop}
        allowPaste={values.allowPaste}
        disabled={values.disabled}
        title="Drop files here, or click"
        description="Any file type, up to 10 MB"
        maxFileSize={10 * 1024 * 1024}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
