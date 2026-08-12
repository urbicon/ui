<script lang="ts">
  import { ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';

  // A run log: here the calls ARE the content, so each one gets a frame of its
  // own instead of the quiet line the chat stream uses.
  const trace: ChatToolCallPart[] = [
    {
      type: 'tool-call',
      id: 'trace-1',
      name: 'list_rooms',
      state: 'complete',
      input: { house: 'cala', nights: 3 },
      output: { available: 4 }
    },
    {
      type: 'tool-call',
      id: 'trace-2',
      name: 'price_stay',
      state: 'error',
      input: { room: 'sea-view-2' },
      errorMessage: 'rate plan expired (RATE_STALE)'
    },
    {
      type: 'tool-call',
      id: 'trace-3',
      name: 'price_stay',
      state: 'running',
      input: { room: 'sea-view-2', refresh: true }
    }
  ];
</script>

<div class="space-y-2">
  {#each trace as call (call.id)}
    <ToolCallCard toolCall={call} variant="card" />
  {/each}
</div>
