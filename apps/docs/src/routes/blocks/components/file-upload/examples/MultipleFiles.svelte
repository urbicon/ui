<script lang="ts">
  import { FileUpload, type FileUploadFile, Badge } from '@urbicon-ui/blocks';

  let files = $state<FileUploadFile[]>([]);
  const maxFiles = 5;
  const remaining = $derived(maxFiles - files.length);
</script>

<div class="max-w-md space-y-3">
  <div class="flex items-center justify-between">
    <h4 class="text-text-primary text-sm font-medium">Upload documents</h4>
    <Badge intent="neutral" variant="soft" size="sm">
      {remaining} of {maxFiles} available
    </Badge>
  </div>

  <FileUpload
    bind:files
    multiple
    {maxFiles}
    title="Drop files here"
    description="Up to {maxFiles} files at once"
    onFileReject={(rejections) => {
      for (const r of rejections) {
        console.warn('Rejected:', r.file.name, r.errors[0]?.message);
      }
    }}
  />
</div>
