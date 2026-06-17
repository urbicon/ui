<script lang="ts">
  import { FileUpload } from '@urbicon-ui/blocks';

  const sizes = ['sm', 'md', 'lg'] as const;
</script>

<div class="space-y-6">
  {#each sizes as size (size)}
    <div>
      <h4 class="text-text-secondary mb-2 text-xs font-medium tracking-wide uppercase">
        {size}
      </h4>
      <div class="max-w-md">
        <FileUpload {size} title="Dateien ablegen ({size})" description="Beliebiger Dateityp" />
      </div>
    </div>
  {/each}
</div>
