<script lang="ts">
  import { onDestroy } from 'svelte';
  import { Button, ReasoningDisclosure, type ChatReasoningPart } from '@urbicon-ui/blocks';

  const full = `Let me work through the layout.

First, the sidebar is fixed-width on desktop but collapses under \`md\`. That points at **SidebarLayout**, not a hand-rolled grid.

Then the main column needs its own scroll region so the header can pin. \`fit="viewport"\` on the content handles that.`;

  // The caller drives `streaming` and grows `text` from the transport; while
  // streaming the header pulses "Thinking", then settles to the duration.
  let reasoning = $state<ChatReasoningPart>({ type: 'reasoning', text: '' });
  let streaming = $state(false);
  let timer: ReturnType<typeof setInterval> | undefined;

  function stream() {
    clearInterval(timer);
    const startedAt = Date.now();
    let i = 0;
    reasoning = { type: 'reasoning', text: '' };
    streaming = true;
    timer = setInterval(() => {
      i += 4;
      if (i >= full.length) {
        clearInterval(timer);
        streaming = false;
        reasoning = { type: 'reasoning', text: full, durationMs: Date.now() - startedAt };
        return;
      }
      reasoning = { ...reasoning, text: full.slice(0, i) };
    }, 40);
  }

  onDestroy(() => clearInterval(timer));
</script>

<div class="space-y-3">
  <ReasoningDisclosure {reasoning} {streaming} defaultOpen />
  <Button size="sm" variant="outlined" onclick={stream}>Stream reasoning</Button>
</div>
