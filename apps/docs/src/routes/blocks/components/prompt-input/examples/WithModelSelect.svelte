<script lang="ts">
  import { PromptInput, Select } from '@urbicon-ui/blocks';

  let draft = $state('');
  let model = $state('sonnet');
  let lastSent = $state<string | null>(null);

  const models = [
    { label: 'Haiku — fast', value: 'haiku' },
    { label: 'Sonnet — balanced', value: 'sonnet' },
    { label: 'Opus — deep', value: 'opus' }
  ];
</script>

<div class="mx-auto flex max-w-xl flex-col gap-3">
  {#if lastSent}
    <p class="text-text-secondary text-sm">Sent to <strong>{model}</strong>: {lastSent}</p>
  {/if}

  <PromptInput
    bind:value={draft}
    placeholder="Ask anything…"
    onSubmit={({ text }) => (lastSent = text)}
  >
    {#snippet trailing()}
      <Select size="xs" options={models} bind:value={model} aria-label="Model" class="w-40" />
    {/snippet}
  </PromptInput>
</div>
