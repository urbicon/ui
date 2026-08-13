<script lang="ts">
  import { FileUpload, UploadCloudIcon, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
</script>

<div class="max-w-md">
  <FileUpload
    bind:files
    multiple
    maxFiles={6}
    accept={['image/*', '.pdf']}
    maxFileSize={8 * 1024 * 1024}
    slotClasses={{
      dropzone:
        'bg-gradient-to-br from-primary/5 via-surface-base to-secondary/5 border-primary/30 hover:border-primary hover:from-primary/10 hover:to-secondary/10 rounded-xl py-12'
    }}
  >
    <div class="flex flex-col items-center gap-3 text-center">
      <div class="bg-primary/10 flex size-14 items-center justify-center rounded-full">
        <UploadCloudIcon strokeWidth={1.5} class="text-primary size-7" />
      </div>
      <div>
        <p class="text-text-primary font-semibold">Upload design assets</p>
        <p class="text-text-tertiary mt-1 text-sm">Images and PDFs, up to 8 MB each</p>
      </div>
      <div
        class="bg-primary text-text-on-primary mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      >
        Choose files
      </div>
    </div>
  </FileUpload>
</div>
