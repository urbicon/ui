<script lang="ts">
  import { FileUpload, IMAGE_MIME_TYPES, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
</script>

<div class="max-w-md">
  <FileUpload
    bind:files
    accept={IMAGE_MIME_TYPES}
    multiple
    allowPaste
    title="Screenshot einfuegen"
    description="Bilder per Ctrl+V / Cmd+V einfuegen oder hier ablegen"
  />

  {#if files.length > 0}
    <p class="text-text-tertiary mt-2 text-xs">
      {files.length} Bild(er) eingefuegt — Paste-Modus aktiv
    </p>
  {/if}
</div>
