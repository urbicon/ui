<script lang="ts">
  import { FileUpload, Alert, type FileUploadFile, type FileRejection } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
  let rejections = $state<FileRejection[]>([]);

  function handleReject(r: FileRejection[]) {
    rejections = r;
    setTimeout(() => (rejections = []), 5000);
  }
</script>

<div class="max-w-md space-y-3">
  <FileUpload
    bind:files
    accept={['.pdf', '.docx', '.xlsx']}
    maxFileSize={2 * 1024 * 1024}
    maxFiles={3}
    multiple
    title="Upload documents"
    description="PDF, DOCX or XLSX, up to 2 MB, 3 files max"
    onFileReject={handleReject}
  />

  {#if rejections.length > 0}
    <Alert intent="danger" variant="soft" dismissible onDismiss={() => (rejections = [])}>
      <div class="space-y-1">
        {#each rejections as rejection (rejection.file.name)}
          <p class="text-sm">
            <span class="font-medium">{rejection.file.name}:</span>
            {rejection.errors.map((e) => e.message).join(', ')}
          </p>
        {/each}
      </div>
    </Alert>
  {/if}
</div>
