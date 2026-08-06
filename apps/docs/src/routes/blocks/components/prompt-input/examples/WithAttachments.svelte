<script lang="ts">
  import { PromptInput, Alert } from '@urbicon-ui/blocks';
  import type { FileIntakeEntry, FileIntakeRejection } from '@urbicon-ui/blocks';

  let draft = $state('');
  let attachments = $state<FileIntakeEntry[]>([]);
  let rejections = $state<FileIntakeRejection[]>([]);
  let lastSent = $state<string | null>(null);

  function handleSubmit(payload: { text: string; attachments: FileIntakeEntry[] }) {
    const names = payload.attachments.map((a) => a.file.name);
    lastSent =
      `"${payload.text}"` +
      (names.length ? ` with ${names.length} file(s): ${names.join(', ')}` : ' (no files)');
    rejections = [];
  }
</script>

<div class="mx-auto flex max-w-xl flex-col gap-3">
  {#if rejections.length > 0}
    <Alert intent="danger" title="Some files were rejected">
      <ul class="list-outside list-disc pl-5 text-sm">
        {#each rejections as r (r.file.name)}
          <li>{r.file.name} — {r.errors[0]?.message}</li>
        {/each}
      </ul>
    </Alert>
  {/if}

  {#if lastSent}
    <p class="text-text-secondary text-sm">Sent: {lastSent}</p>
  {/if}

  <PromptInput
    bind:value={draft}
    bind:attachments
    allowAttachments
    accept="image/*"
    maxFiles={3}
    maxFileSize={2 * 1024 * 1024}
    placeholder="Add up to 3 images (≤ 2 MB each) and describe them…"
    onSubmit={handleSubmit}
    onAttachmentReject={(r) => (rejections = r)}
  >
    {#snippet hint()}
      <span>Attach via the paperclip, drag-and-drop, or paste a screenshot.</span>
    {/snippet}
  </PromptInput>
</div>
