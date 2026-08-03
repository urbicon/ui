<script lang="ts">
  import { FileUpload, Button, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
  let uploading = $state(false);

  function simulateUpload() {
    if (files.length === 0 || uploading) return;
    uploading = true;

    const pending = files.filter((f) => f.status === 'pending');
    if (pending.length === 0) {
      uploading = false;
      return;
    }

    let idx = 0;

    function uploadNext() {
      if (idx >= pending.length) {
        uploading = false;
        return;
      }

      const entry = pending[idx];
      entry.status = 'uploading';
      entry.progress = 0;
      files = [...files];

      const interval = setInterval(() => {
        entry.progress = Math.min((entry.progress ?? 0) + Math.random() * 15 + 5, 100);
        files = [...files];

        if (entry.progress >= 100) {
          clearInterval(interval);
          entry.status = Math.random() > 0.15 ? 'complete' : 'error';
          if (entry.status === 'error') {
            entry.errors = [{ code: 'CUSTOM', message: 'Netzwerkfehler beim Upload' }];
          }
          files = [...files];
          idx++;
          setTimeout(uploadNext, 300);
        }
      }, 200);
    }

    uploadNext();
  }
</script>

<div class="max-w-md space-y-3">
  <FileUpload
    bind:files
    multiple
    maxFiles={4}
    title="Choose files to upload"
    description="Klicke 'Upload starten' nach der Auswahl"
  />

  {#if files.length > 0}
    <div class="flex justify-end">
      <Button
        intent="primary"
        size="sm"
        onclick={simulateUpload}
        loading={uploading}
        disabled={uploading || files.every((f) => f.status !== 'pending')}
      >
        Upload starten
      </Button>
    </div>
  {/if}
</div>
