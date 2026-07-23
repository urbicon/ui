<script lang="ts">
  import { ChatMessage, type ChatMessageData, type ChatToolCallPart } from '@urbicon-ui/blocks';

  const message: ChatMessageData = {
    id: 'custom-tool-1',
    role: 'assistant',
    parts: [
      {
        type: 'tool-call',
        id: 'tc-weather',
        name: 'get_weather',
        state: 'complete',
        input: { city: 'Berlin' },
        output: { tempC: 7, condition: 'Overcast' }
      },
      { type: 'text', text: "It's **7 °C** and overcast in Berlin right now." }
    ],
    createdAt: new Date('2026-01-01T09:41:00'),
    status: 'complete'
  };
</script>

<!--
  partRenderers swaps the built-in tool-call presentation for your own, keyed by
  the part `type`. The snippet receives the fully-typed tool-call part.
-->
{#snippet toolCall(part: ChatToolCallPart)}
  <div
    class="border-border-subtle bg-surface-base rounded-modify flex items-center gap-2 border px-3 py-2 text-sm"
  >
    <span class="bg-success size-2 rounded-full"></span>
    <span class="text-text-primary font-medium">{part.name}</span>
    <span class="text-text-tertiary">→ {part.state}</span>
  </div>
{/snippet}

<div class="w-full max-w-2xl">
  <ChatMessage {message} layout="plain" partRenderers={{ 'tool-call': toolCall }} />
</div>
