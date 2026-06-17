<script lang="ts">
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
</script>

<div class="max-w-md">
  <FileUpload
    bind:files
    title="Datei hier ablegen oder klicken"
    description="Beliebiger Dateityp, max. 10 MB"
    maxFileSize={10 * 1024 * 1024}
  />

  {#if files.length > 0}
    <div class="bg-surface-elevated border-border-subtle mt-3 rounded-lg border p-3">
      <p class="text-text-secondary text-sm">
        <span class="text-text-primary font-medium">{files.length}</span> Datei(en) ausgewaehlt
      </p>
    </div>
  {/if}
</div>
