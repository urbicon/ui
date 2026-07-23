<script lang="ts">
  import { PromptInput, SparklesIcon } from '@urbicon-ui/blocks';

  type Msg = { id: string; role: 'user' | 'assistant'; text: string };

  let draft = $state('');
  let busy = $state(false);
  let messages = $state<Msg[]>([]);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function send(text: string) {
    messages = [...messages, { id: crypto.randomUUID(), role: 'user', text }];
    busy = true;
    // Simulate a streaming response; the Send button becomes a Stop button
    // while `busy` is true, and Enter no longer submits.
    timer = setTimeout(() => {
      messages = [
        ...messages,
        { id: crypto.randomUUID(), role: 'assistant', text: 'Here is a reply to: ' + text }
      ];
      busy = false;
    }, 2200);
  }

  function stop() {
    clearTimeout(timer);
    busy = false;
    messages = [...messages, { id: crypto.randomUUID(), role: 'assistant', text: '(stopped)' }];
  }
</script>

<div class="mx-auto flex max-w-xl flex-col gap-3">
  {#if messages.length > 0}
    <div class="flex flex-col gap-2">
      {#each messages as msg (msg.id)}
        {#if msg.role === 'user'}
          <div
            class="bg-primary text-text-on-primary ml-auto max-w-[80%] rounded-2xl px-3 py-2 text-sm"
          >
            {msg.text}
          </div>
        {:else}
          <div class="text-text-secondary flex max-w-[85%] items-start gap-2 text-sm">
            <SparklesIcon class="text-primary mt-0.5 size-4 shrink-0" />
            <span>{msg.text}</span>
          </div>
        {/if}
      {/each}
    </div>
  {/if}

  <PromptInput
    bind:value={draft}
    {busy}
    placeholder="Message the assistant…"
    onSubmit={({ text }) => send(text)}
    onStop={stop}
  >
    {#snippet hint()}
      <span>Enter to send · Shift+Enter for a new line</span>
    {/snippet}
  </PromptInput>
</div>
