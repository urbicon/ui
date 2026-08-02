<script lang="ts">
  import { ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';

  // Deterministic driver page for the e2e chat-list spec: every scroll-engine
  // behaviour (stick / interrupt / jump-back / prepend anchor / announcements)
  // is triggered through explicit buttons instead of playground timing.

  const FILLER =
    'This paragraph exists to give every fixture message enough height that the list actually scrolls. ' +
    'It repeats a few clauses so the viewport overflows quickly and reliably in a 24rem frame.';

  let counter = 0;
  let historyBatch = 0;
  let streamTimer: ReturnType<typeof setInterval> | undefined;

  function makeMsg(
    id: string,
    role: ChatMessageData['role'],
    text: string,
    status?: ChatMessageData['status']
  ): ChatMessageData {
    return { id, role, parts: [{ type: 'text', text }], status };
  }

  function seed(): ChatMessageData[] {
    const list: ChatMessageData[] = [];
    for (let i = 1; i <= 10; i++) {
      counter = i;
      list.push(
        makeMsg(`m${i}`, i % 2 === 1 ? 'user' : 'assistant', `Seed message ${i}. ${FILLER}`)
      );
    }
    return list;
  }

  let messages = $state<ChatMessageData[]>(seed());
  let stuck = $state(true);

  function append(n: number) {
    const added: ChatMessageData[] = [];
    for (let i = 0; i < n; i++) {
      counter += 1;
      added.push(makeMsg(`m${counter}`, 'assistant', `Appended message ${counter}. ${FILLER}`));
    }
    messages = [...messages, ...added];
  }

  function prependHistory() {
    historyBatch += 1;
    const older: ChatMessageData[] = [];
    for (let i = 1; i <= 5; i++) {
      older.push(
        makeMsg(`h${historyBatch}-${i}`, 'assistant', `History ${historyBatch}-${i}. ${FILLER}`)
      );
    }
    messages = [...older, ...messages];
  }

  function startStream() {
    if (streamTimer) return;
    counter += 1;
    const id = `m${counter}`;
    let ticks = 0;
    messages = [...messages, makeMsg(id, 'assistant', '', 'streaming')];
    streamTimer = setInterval(() => {
      ticks += 1;
      const done = ticks >= 12;
      const text = Array.from({ length: ticks }, (_, i) => `Streamed sentence ${i + 1}.`).join(' ');
      messages = messages.map((m) =>
        m.id === id
          ? { ...m, parts: [{ type: 'text', text }], status: done ? 'complete' : 'streaming' }
          : m
      );
      if (done && streamTimer) {
        clearInterval(streamTimer);
        streamTimer = undefined;
      }
    }, 80);
  }

  // e2e waits for this marker: SSR serves the full markup long before the
  // client runtime (and the scroll engine's effects) are live.
  let hydrated = $state(false);
  $effect(() => {
    hydrated = true;
    return () => {
      if (streamTimer) clearInterval(streamTimer);
    };
  });
</script>

<svelte:head>
  <title>Chat fixtures</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div
  data-testid="chat-fixtures"
  data-hydrated={hydrated || undefined}
  class="mx-auto max-w-3xl space-y-4 p-6"
>
  <div class="flex flex-wrap items-center gap-2">
    <button
      type="button"
      data-testid="append-one"
      class="rounded-modify border-border-default border px-3 py-1.5 text-sm"
      onclick={() => append(1)}>Append one</button
    >
    <button
      type="button"
      data-testid="append-burst"
      class="rounded-modify border-border-default border px-3 py-1.5 text-sm"
      onclick={() => append(3)}>Append burst</button
    >
    <button
      type="button"
      data-testid="prepend-history"
      class="rounded-modify border-border-default border px-3 py-1.5 text-sm"
      onclick={prependHistory}>Prepend history</button
    >
    <button
      type="button"
      data-testid="start-stream"
      class="rounded-modify border-border-default border px-3 py-1.5 text-sm"
      onclick={startStream}>Start stream</button
    >
    <span data-testid="stick-state" class="text-text-secondary text-sm"
      >{stuck ? 'stuck' : 'unstuck'}</span
    >
  </div>

  <div class="rounded-contain border-border-default h-[24rem] overflow-hidden border">
    <ChatMessageList {messages} onStickChange={(s) => (stuck = s)}>
      {#snippet message({ message: msg })}
        <div
          data-fixture-id={msg.id}
          class="rounded-contain border-border-subtle bg-surface-elevated text-text-primary border p-3 text-sm"
        >
          <span class="text-text-tertiary font-mono text-xs">{msg.id}</span>
          <p>{msg.parts[0]?.type === 'text' ? msg.parts[0].text : ''}</p>
        </div>
      {/snippet}
    </ChatMessageList>
  </div>
</div>
