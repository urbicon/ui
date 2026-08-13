<script lang="ts">
  import { FileUpload, IMAGE_MIME_TYPES, type FileUploadFile } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
</script>

<div class="max-w-lg">
  <FileUpload
    bind:files
    accept={IMAGE_MIME_TYPES}
    multiple
    maxFiles={8}
    maxFileSize={5 * 1024 * 1024}
    title="Upload images"
    description="PNG, JPG, WebP, GIF or AVIF, up to 5 MB each"
  />

  <!-- Custom grid preview below the component -->
  {#if files.length > 0}
    <div class="mt-4 grid grid-cols-4 gap-2">
      {#each files as entry (entry.id)}
        {#if entry.preview}
          <div
            class="bg-surface-base border-border-subtle group relative aspect-square overflow-hidden rounded-lg border"
          >
            <img
              src={entry.preview}
              alt={entry.file.name}
              class="size-full object-cover transition-transform duration-[var(--blocks-duration-fast)] group-hover:scale-105"
            />
            <div
              class="from-surface-inverted/60 absolute inset-x-0 bottom-0 bg-gradient-to-t to-transparent p-2"
            >
              <p class="text-text-inverted truncate text-xs">{entry.file.name}</p>
            </div>
          </div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
