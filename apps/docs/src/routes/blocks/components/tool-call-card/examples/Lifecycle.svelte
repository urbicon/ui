<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, ToolCallCard, type ChatToolCallPart } from '@urbicon-ui/blocks';

  // The consumer owns the part and mutates its `state` / `output` as the
  // real call resolves — here a timer stands in for the transport layer.
  let call = $state<ChatToolCallPart>({
    type: 'tool-call',
    id: 'weather-1',
    name: 'get_weather',
    state: 'running',
    input: { city: 'Berlin', unit: 'celsius' }
  });

  let timer: ReturnType<typeof setTimeout> | undefined;

  function run() {
    clearTimeout(timer);
    call = { ...call, state: 'running', output: undefined };
    timer = setTimeout(() => {
      call = {
        ...call,
        state: 'complete',
        output: { temperature: 21, condition: 'Partly cloudy', humidity: 0.54 }
      };
    }, 1600);
  }

  onDestroy(() => clearTimeout(timer));
</script>

<div class="space-y-3">
  <ToolCallCard toolCall={call} />
  <Button size="sm" variant="outlined" onclick={run}>Replay call</Button>
</div>
