<script lang="ts">
  // Test-only: the FormField `@example` (primitives/FormField/index.ts) as a consumer copies
  // it, so the label-association tests mount that wiring and nothing else. Under __fixtures__/
  // so it is excluded from the published package.
  import FormField from '#lib/primitives/FormField/FormField.svelte';
  import type { FileUploadFile, FileUploadProps } from '../index';
  import FileUpload from '../FileUpload.svelte';

  let {
    error,
    helper = 'PDF, JPG, PNG — max 10 MB',
    files = $bindable([]),
    ...uploadProps
  }: Partial<FileUploadProps> & {
    error?: string;
    helper?: string;
    files?: FileUploadFile[];
  } = $props();
</script>

<FormField label="Document" required {error} {helper}>
  {#snippet children({ id, describedBy, invalid })}
    <FileUpload
      {...uploadProps}
      {id}
      aria-describedby={describedBy}
      aria-invalid={invalid || undefined}
      bind:files
    />
  {/snippet}
</FormField>
