<script lang="ts">
  import {
    A2UIView,
    A2uiStreamSplitter,
    A2uiSurfaceRouter,
    ChatMessage,
    ChatMessageList,
    PromptInput,
    routeMessageParts,
    urbiconA2uiCatalog,
    type A2uiActionEvent,
    type ChatMessageData,
    type ChatMessagePart
  } from '@urbicon-ui/blocks';
  import { untrack } from 'svelte';
  import { SvelteSet } from 'svelte/reactivity';
  import { BOOKING_SCHEMA } from '$lib/booking-schema';
  import { replayTurn, TURNS } from '$lib/replay/player';

  /**
   * The booking assistant, embedded in the salon page.
   *
   * Structurally the same client as the developer testbed on `/`: a splitter
   * turns the token stream into text + A2UI parts, a router delivers later
   * envelopes into the surface that already exists, and A2UIView renders the
   * result with real components. The one difference is the transport — frames
   * come from a recording rather than from the network (see `replay/player`),
   * so the demo shows the same thing every time.
   *
   * There is deliberately NO styling of the generated surface here. Whatever
   * livery is active reaches it through tokens alone.
   */

  let {
    /**
     * Settle straight into the finished state instead of streaming — for the
     * tile version, which must already show the surface when it comes into
     * view. Same pipeline, no waiting (see `replay/player`).
     */
    instant = false,
    /** Play the opening turn on mount. Tiles do; the full page waits to be asked. */
    autoStart = false,
    /** Hide the composer. A tile is a specimen, not a place to type. */
    composer = true
  }: { instant?: boolean; autoStart?: boolean; composer?: boolean } = $props();

  let root: HTMLDivElement | undefined = $state();
  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);
  let controller: AbortController | undefined;
  /** Which recorded turn plays next. */
  let cursor = $state(0);

  let idSeq = 0;
  // urbicon-ignore dynamic-class-interpolation — `m-1`, `m-2`… are message ids for
  // the chat transcript, never class names. The rule reads the `m-` prefix as the
  // margin utility, which this template has nothing to do with.
  const nextId = () => `m-${++idSeq}`;

  const router = new A2uiSurfaceRouter();
  const patchTargets = new SvelteSet<string>();

  function patch(id: string, next: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...next } : m));
  }

  function routeParts(messageId: string, parts: ChatMessagePart[]): ChatMessagePart[] {
    const result = routeMessageParts(router, messages, messageId, parts);
    messages = result.messages;
    for (const target of result.targets) patchTargets.add(target);
    return result.parts;
  }

  type ToolPart = Extract<ChatMessagePart, { type: 'tool-call' }>;
  type Segment = { splitter: A2uiStreamSplitter } | { tool: ToolPart };

  async function play(displayText: string) {
    if (busy || cursor >= TURNS.length) return;
    const index = cursor++;

    messages = [
      ...messages,
      {
        id: nextId(),
        role: 'user',
        parts: [{ type: 'text', text: displayText }],
        status: 'complete'
      }
    ];

    const assistantId = nextId();
    const segments: Segment[] = [];
    let splitter = new A2uiStreamSplitter();
    segments.push({ splitter });

    const assemble = (): ChatMessagePart[] =>
      segments.flatMap((segment) =>
        'splitter' in segment ? (segment.splitter.snapshot() as ChatMessagePart[]) : [segment.tool]
      );
    const patchLive = () => patch(assistantId, { parts: routeParts(assistantId, assemble()) });

    messages = [
      ...messages,
      {
        id: assistantId,
        role: 'assistant',
        parts: [{ type: 'text', text: '' }],
        status: 'streaming'
      }
    ];

    busy = true;
    controller = new AbortController();

    try {
      for await (const frame of replayTurn(index, { signal: controller.signal, instant })) {
        const data = JSON.parse(frame.data) as {
          text?: string;
          id?: string;
          name?: string;
          input?: unknown;
          output?: unknown;
        };
        if (frame.event === 'token') {
          splitter.push(data.text ?? '');
          patchLive();
        } else if (frame.event === 'tool_start') {
          splitter.end();
          segments.push({
            tool: {
              type: 'tool-call',
              id: data.id ?? `tool-${segments.length}`,
              name: data.name ?? 'tool',
              state: 'running',
              input: data.input
            }
          });
          patchLive();
        } else if (frame.event === 'tool_result') {
          for (const segment of segments) {
            if ('tool' in segment && segment.tool.id === data.id) {
              segment.tool = { ...segment.tool, state: 'complete', output: data.output };
            }
          }
          splitter = new A2uiStreamSplitter();
          segments.push({ splitter });
          patchLive();
        }
      }
      splitter.end();
      patch(assistantId, { parts: routeParts(assistantId, assemble()), status: 'complete' });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') throw err;
      patch(assistantId, { status: 'aborted' });
    } finally {
      busy = false;
      controller = undefined;
      patchTargets.clear();
    }
  }

  /**
   * A button on the generated surface. The recording's second turn IS the
   * agent's answer to this press, so the round trip is real — the click drives
   * the conversation forward rather than miming it.
   */
  function handleAction(event: A2uiActionEvent) {
    play(`▸ ${event.name}`);
  }

  export function start() {
    play(TURNS[0]?.wire ?? '');
  }

  export function reset() {
    controller?.abort();
    messages = [];
    cursor = 0;
    patchTargets.clear();
  }

  function handleSubmit(payload: { text: string }) {
    play(payload.text);
  }

  // `untrack` IS needed here, and the reason is not obvious: `start()` calls
  // `play()`, whose guard reads `busy` and `cursor` — both `$state`. Reading
  // them inside the effect makes the effect depend on them, so finishing a turn
  // (which sets `busy = false` and advances `cursor`) re-runs it and plays the
  // NEXT turn. The tile mounted showing the confirmation instead of the form.
  $effect(() => {
    if (autoStart) untrack(start);
  });

  $effect(() => () => controller?.abort());
</script>

<div class="flex min-h-0 flex-1 flex-col" bind:this={root}>
  <ChatMessageList
    {messages}
    emptyTitle="Ask for an appointment"
    emptyDescription="The assistant builds the form it needs — in this salon's own hand."
  >
    {#snippet message({ message: m })}
      {#snippet a2uiPart(part: Extract<ChatMessagePart, { type: 'a2ui' }>)}
        <A2UIView
          payload={part.payload}
          streaming={m.status === 'streaming' || patchTargets.has(m.id)}
          catalogs={[urbiconA2uiCatalog]}
          dataSchema={BOOKING_SCHEMA}
          onAction={handleAction}
        />
      {/snippet}
      <ChatMessage message={m} partRenderers={{ a2ui: a2uiPart }} />
    {/snippet}
  </ChatMessageList>

  {#if composer}
    <div class="p-3">
      <PromptInput
        {busy}
        placeholder={cursor >= TURNS.length
          ? 'That is the end of the recording — reset to replay'
          : 'Ask for an appointment…'}
        onSubmit={handleSubmit}
        onStop={() => controller?.abort()}
      />
    </div>
  {/if}
</div>
