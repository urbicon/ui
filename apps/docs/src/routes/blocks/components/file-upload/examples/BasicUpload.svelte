<script lang="ts">
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
</script>

<div class="max-w-md">
  <FileUpload
    bind:files
    title="Drop a file here, or click"
    description="Any file type, up to 10 MB"
    maxFileSize={10 * 1024 * 1024}
  />

  {#if files.length > 0}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">{files.length}</span> file(s) selected
      </p>
    </div>
  {/if}
</div>
