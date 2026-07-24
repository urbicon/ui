<script lang="ts">
  import {
    A2UIView,
    A2uiStreamSplitter,
    A2uiSurfaceRouter,
    Alert,
    Badge,
    Chat,
    ChatMessage,
    ChatMessageList,
    PromptInput,
    revokeMessage,
    routeMessageParts,
    urbiconA2uiCatalog,
    type A2uiActionEvent,
    type A2uiValidationIssue,
    type ChatMessageData,
    type ChatMessagePart,
    type PatchedSurface
  } from '@urbicon-ui/blocks';
  import { SseRequestError, streamSse } from '@urbicon-ui/sveltekit-utils/sse';
  import { SvelteSet } from 'svelte/reactivity';
  import { page } from '$app/state';
  import { BOOKING_SCHEMA } from '$lib/booking-schema';

  // Catalog A/B toggle: the Urbicon-native catalog (full vocabulary + data
  // schema) by default; `?catalog=basic` renders the v0.9.1 Basic subset. Both
  // the client (A2UIView config) and the server (system prompt) read it.
  const useBasic = $derived(page.url.searchParams.get('catalog') === 'basic');

  interface WireMessage {
    role: 'user' | 'assistant';
    content: string;
  }

  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);
  let controller: AbortController | undefined;
  // Validation errors from any A2UIView, queued to be reported to the agent on
  // the next user send (prefixed as a `[ui-error]` line).
  let pendingIssues = $state<A2uiValidationIssue[]>([]);
  let errorBanner = $state('');

  let idSeq = 0;
  const nextId = () => `m-${++idSeq}`;

  const emptyHint = 'Try: "Build me a small booking form for a haircut appointment."';

  // In-place patch: replace one message by id (never mutate the element).
  function patch(id: string, next: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...next } : m));
  }

  // Flatten a message to the wire shape. `metadata.raw` wins for BOTH roles:
  // assistant turns carry the verbatim model output (fences included), user
  // turns carry the `[ui-action]`/`[ui-error]` wire form behind a friendlier
  // display text. NOTE: tool_use/tool_result blocks are NOT replayed into the
  // wire history (POC simplification) — the model sees its own prose + UI, not
  // its past tool transcripts.
  function toWire(m: ChatMessageData): WireMessage {
    const raw = m.metadata?.raw;
    if (typeof raw === 'string') {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: raw };
    }
    const content = m.parts
      .filter((p): p is Extract<ChatMessagePart, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('');
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content };
  }

  const issueSig = (i: A2uiValidationIssue) =>
    `${i.code}|${i.surfaceId ?? ''}|${i.path ?? ''}|${i.message}`;

  // ── Cross-message surface routing ─────────────────────────────────────────
  // A surface lives in the payload of the message that created it. When a later
  // turn patches it (updateDataModel/updateComponents for that surfaceId), the
  // router hands those envelopes to THAT payload, and the card updates where it
  // stands instead of failing as an unknown surface. The transcript-side wiring
  // lives in `$lib/surface-routing` (pure, unit-tested).
  const router = new A2uiSurfaceRouter();

  // Surfaces a message patched elsewhere → drives the jump chip and the marker
  // on the patched message. This is also the promotion ledger: everything in
  // here has proven it outlives its own turn. Keyed by the PATCHING message id.
  let patchesByMessage = $state<Record<string, PatchedSurface[]>>({});
  // Messages currently receiving patches. They render with `streaming` on, so a
  // half-arrived patch shows placeholders instead of dangling-reference chips —
  // the same grace the message got while it was first streaming.
  const patchTargets = new SvelteSet<string>();
  const patchedMessageIds = $derived(
    new Set(
      Object.values(patchesByMessage).flatMap((entries) => entries.map((e) => e.targetMessageId))
    )
  );

  /**
   * Route a message's parts before storing them: patches are delivered into
   * earlier payloads here, so the caller must write the returned parts on top of
   * the updated `messages`.
   */
  function routeParts(messageId: string, parts: ChatMessagePart[]): ChatMessagePart[] {
    const result = routeMessageParts(router, messages, messageId, parts);
    messages = result.messages;
    for (const target of result.targets) patchTargets.add(target);
    // Routing issues go back to the agent regardless of severity: a recreated
    // surfaceId is a protocol slip it should correct, not a rendering blemish.
    queueIssues(result.issues);
    if (result.promoted.length > 0) {
      const merged = [...(patchesByMessage[messageId] ?? [])];
      for (const entry of result.promoted) {
        if (!merged.some((e) => e.surfaceId === entry.surfaceId)) merged.push(entry);
      }
      patchesByMessage = { ...patchesByMessage, [messageId]: merged };
    }
    return result.parts;
  }

  /** Forget every source of a message that is leaving the transcript. */
  function forgetMessage(message: ChatMessageData) {
    messages = revokeMessage(router, messages, message.id);
    if (patchesByMessage[message.id]) {
      const { [message.id]: _dropped, ...rest } = patchesByMessage;
      patchesByMessage = rest;
    }
  }

  function scrollToMessage(messageId: string) {
    document
      .getElementById(`a2ui-anchor-${messageId}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // The assistant turn is assembled from SEGMENTS in stream order: one
  // A2uiStreamSplitter per model round (text + a2ui fences), with a tool-call
  // part between rounds wherever the model stopped to call a tool. ChatMessage
  // renders the tool-call parts as ToolCallCards by default.
  type ToolPart = Extract<ChatMessagePart, { type: 'tool-call' }>;
  type Segment = { splitter: A2uiStreamSplitter } | { tool: ToolPart };

  async function runTurn(wireUserText: string, displayUserText?: string) {
    if (busy) return;

    let wire = wireUserText;
    let display = displayUserText ?? wireUserText;
    // Prepend queued validation errors so the agent can repair the surface.
    if (pendingIssues.length > 0) {
      const count = pendingIssues.length;
      wire = `[ui-error] ${JSON.stringify(pendingIssues)}\n${wire}`;
      display = `⚠ Reporting ${count} validation issue${count === 1 ? '' : 's'} to the agent\n\n${display}`;
      pendingIssues = [];
    }
    errorBanner = '';

    messages = [
      ...messages,
      {
        id: nextId(),
        role: 'user',
        parts: [{ type: 'text', text: display }],
        status: 'complete',
        metadata: display === wire ? undefined : { raw: wire }
      }
    ];

    // Snapshot BEFORE the empty assistant turn; drop text-less turns (the Messages
    // API rejects empty content, which would wedge the chat).
    const history = messages.map(toWire).filter((m) => m.content.length > 0);

    const assistantId = nextId();
    const segments: Segment[] = [];
    let splitter = new A2uiStreamSplitter();
    segments.push({ splitter });
    const assemble = (): ChatMessagePart[] =>
      segments.flatMap((segment) =>
        'splitter' in segment ? (segment.splitter.snapshot() as ChatMessagePart[]) : [segment.tool]
      );
    // Rounds are separate model turns — join with a blank line so the wire
    // history never glues the last word of one round to the first of the next.
    const rawText = () =>
      segments
        .map((segment) => ('splitter' in segment ? segment.splitter.raw : ''))
        .filter((raw) => raw !== '')
        .join('\n\n');
    // Route BEFORE storing: `routeParts` delivers foreign envelopes into earlier
    // payloads (mutating `messages`), and `patch` then writes this message's own
    // parts on top of that already-updated list.
    const patchLive = () =>
      patch(assistantId, {
        parts: routeParts(assistantId, assemble()),
        metadata: { raw: rawText() }
      });

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
    let failed = false;

    try {
      const endpoint = useBasic ? '/api/chat?catalog=basic' : '/api/chat';
      for await (const frame of streamSse(endpoint, {
        body: { messages: history },
        signal: controller.signal
      })) {
        const data = JSON.parse(frame.data) as {
          text?: string;
          message?: string;
          id?: string;
          name?: string;
          input?: unknown;
          output?: unknown;
        };
        if (frame.event === 'token') {
          splitter.push(data.text ?? '');
          patchLive();
        } else if (frame.event === 'tool_start') {
          // The model stopped this round to call a tool: settle the round's
          // splitter and surface the call as a running ToolCallCard.
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
          // The follow-up round streams into a fresh splitter.
          splitter = new A2uiStreamSplitter();
          segments.push({ splitter });
          patchLive();
        } else if (frame.event === 'error') {
          failed = true;
          errorBanner = data.message ?? 'stream failed';
          patch(assistantId, { status: 'error' });
        }
      }

      splitter.end();
      patch(assistantId, {
        parts: routeParts(assistantId, assemble()),
        metadata: { raw: rawText() },
        status: failed ? 'error' : 'complete'
      });
    } catch (err) {
      if (err instanceof SseRequestError) {
        let message = err.body;
        try {
          message = (JSON.parse(err.body) as { message?: string }).message ?? err.body;
        } catch {
          /* keep raw body */
        }
        errorBanner = message || `Request failed (${err.status})`;
        patch(assistantId, { status: 'error' });
        return;
      }
      const aborted = (err as Error).name === 'AbortError';
      patch(assistantId, { status: aborted ? 'aborted' : 'error' });
      if (!aborted) errorBanner = (err as Error).message;
    } finally {
      busy = false;
      controller = undefined;
      // The patch has fully arrived: hand the target back to strict validation,
      // so a reference that is STILL dangling is now a real fault worth showing.
      patchTargets.clear();
    }
  }

  function handleSubmit(payload: { text: string }) {
    runTurn(payload.text);
  }

  function stop() {
    controller?.abort();
  }

  function regenerate(message: ChatMessageData) {
    if (busy) return;
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx < 1) return;
    const prior = messages[idx - 1];
    if (prior?.role !== 'user') return;
    // Strip a stale [ui-error] prefix from the replayed wire: those issues
    // belonged to the failed turn, and runTurn re-prefixes whatever is queued
    // NOW — keeping both would double-report.
    const wire = toWire(prior).content.replace(/^\[ui-error\] [^\n]*\n/, '');
    const display = prior.parts
      .filter((p): p is Extract<ChatMessagePart, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('');
    // Retract what the dropped turns had patched into earlier messages before
    // they leave — an orphaned patch would keep editing a surface whose author
    // is gone.
    for (const dropped of messages.slice(idx - 1)) forgetMessage(dropped);
    messages = messages.slice(0, idx - 1);
    runTurn(wire, display === wire ? undefined : display);
  }

  // A Button on a rendered surface → a fresh user turn carrying the action event
  // on the wire, shown as a compact summary instead of raw JSON.
  function handleAction(event: A2uiActionEvent) {
    if (busy) return;
    runTurn(`[ui-action] ${JSON.stringify(event)}`, `▸ ${event.name}`);
  }

  /** Queue issues (deduped) to report to the agent on the next send. */
  function queueIssues(issues: A2uiValidationIssue[]) {
    if (issues.length === 0) return;
    const seen = new Set(pendingIssues.map(issueSig));
    const next = [...pendingIssues];
    for (const issue of issues) {
      if (!seen.has(issueSig(issue))) {
        seen.add(issueSig(issue));
        next.push(issue);
      }
    }
    pendingIssues = next;
  }

  // Rendering issues: only errors are worth a round-trip — warnings there are
  // degradations the surface survived.
  function handleValidationError(issues: A2uiValidationIssue[]) {
    queueIssues(issues.filter((i) => i.severity === 'error'));
  }

  $effect(() => () => controller?.abort());
</script>

<svelte:head>
  <title>A2UI chat demo</title>
</svelte:head>

<div class="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-6">
  <header class="flex items-baseline justify-between">
    <div>
      <h1 class="text-lg font-semibold text-text-primary">A2UI chat demo</h1>
      <p class="text-sm text-text-secondary">
        Ask for a form or a chooser — the agent replies with live Urbicon UI.
      </p>
    </div>
    <div class="flex items-center gap-3">
      <!-- Catalog A/B toggle (query-driven; switching keeps the conversation). -->
      <div
        class="flex items-center gap-0.5 rounded-modify border border-border-subtle p-0.5 text-xs"
        role="group"
        aria-label="A2UI catalog"
      >
        <a
          href="/"
          data-sveltekit-noscroll
          class={[
            'rounded-modify px-2 py-1',
            useBasic ? 'text-text-secondary' : 'bg-primary text-text-on-primary'
          ]}
          aria-current={useBasic ? undefined : 'page'}
        >
          Urbicon
        </a>
        <a
          href="?catalog=basic"
          data-sveltekit-noscroll
          class={[
            'rounded-modify px-2 py-1',
            useBasic ? 'bg-primary text-text-on-primary' : 'text-text-secondary'
          ]}
          aria-current={useBasic ? 'page' : undefined}
        >
          Basic
        </a>
      </div>
      <Badge intent={busy ? 'primary' : 'neutral'} variant="soft" size="sm">
        {busy ? 'generating' : 'idle'}
      </Badge>
    </div>
  </header>

  {#if errorBanner}
    <Alert intent="danger" title="Request failed">{errorBanner}</Alert>
  {/if}

  {#if pendingIssues.length > 0}
    <Alert intent="warning" title="Validation issues queued">
      {pendingIssues.length} issue{pendingIssues.length === 1 ? '' : 's'} will be reported to the agent
      with your next message.
    </Alert>
  {/if}

  <div class="flex min-h-0 flex-1 overflow-hidden rounded-contain border border-border-default">
    <Chat class="flex-1">
      {#snippet header()}
        <div class="px-4 py-2.5 text-sm font-medium text-text-primary">AI Assistant</div>
      {/snippet}

      <ChatMessageList {messages} emptyTitle="Start the conversation" emptyDescription={emptyHint}>
        {#snippet message({ message: m, isLast })}
          {#snippet a2uiPart(part: Extract<ChatMessagePart, { type: 'a2ui' }>)}
            <A2UIView
              payload={part.payload}
              streaming={m.status === 'streaming' || patchTargets.has(m.id)}
              catalogs={useBasic ? undefined : [urbiconA2uiCatalog]}
              dataSchema={useBasic ? undefined : BOOKING_SCHEMA}
              onAction={handleAction}
              onValidationError={handleValidationError}
            />
          {/snippet}
          <!--
            A surface that a later turn patched is long-lived: it is no longer
            just a record of one reply. Until it earns a place of its own (a
            pinned card, an artifact panel), it stays inline and the two ends of
            the edit are labelled — a marker here, a jump link over there.
          -->
          <div id={`a2ui-anchor-${m.id}`}>
            {#if patchedMessageIds.has(m.id)}
              <div class="mb-1 flex justify-center">
                <Badge intent="primary" variant="soft" size="sm">Updated by a later reply</Badge>
              </div>
            {/if}
            <ChatMessage
              message={m}
              onRegenerate={isLast && m.role === 'assistant' && !busy
                ? () => regenerate(m)
                : undefined}
              onRetry={m.status === 'error' || m.status === 'aborted'
                ? () => regenerate(m)
                : undefined}
              partRenderers={{ a2ui: a2uiPart }}
            />
            {#each patchesByMessage[m.id] ?? [] as entry (entry.surfaceId)}
              <button
                type="button"
                class="mt-1 rounded-modify px-2 py-1 text-xs text-primary hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                onclick={() => scrollToMessage(entry.targetMessageId)}
              >
                ↑ Updated the surface above — jump to it
              </button>
            {/each}
          </div>
        {/snippet}
      </ChatMessageList>

      {#snippet composer()}
        <div class="p-3">
          <PromptInput
            {busy}
            placeholder="Ask for a form, a chooser, or anything…"
            onSubmit={handleSubmit}
            onStop={stop}
          />
        </div>
      {/snippet}
    </Chat>
  </div>
</div>
