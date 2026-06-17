<script lang="ts">
  import { FileUpload, type FileUploadFile } from '@urbicon-ui/blocks';

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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="text-primary size-7"
        >
          <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
          <path d="M12 12v9" />
          <path d="m16 16-4-4-4 4" />
        </svg>
      </div>
      <div>
        <p class="text-text-primary font-semibold">Design-Assets hochladen</p>
        <p class="text-text-tertiary mt-1 text-sm">Bilder und PDFs, max. 8 MB pro Datei</p>
      </div>
      <div
        class="bg-primary text-text-on-primary mt-1 inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium"
      >
        Dateien auswaehlen
      </div>
    </div>
  </FileUpload>
</div>
