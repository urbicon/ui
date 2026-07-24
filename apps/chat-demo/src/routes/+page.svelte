<script lang="ts">
  import {
    A2UIView,
    Alert,
    Badge,
    Chat,
    ChatMessage,
    ChatMessageList,
    PromptInput,
    type A2uiActionEvent,
    type A2uiValidationIssue,
    type ChatMessageData,
    type ChatMessagePart
  } from '@urbicon-ui/blocks';
  import { A2uiStreamSplitter } from '$lib/a2ui-stream';

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

  // Flatten a message to the wire shape. Assistant turns are sent back with their
  // RAW model output (fences included) so the agent sees its own prior UI verbatim.
  function toWire(m: ChatMessageData): WireMessage {
    if (m.role === 'assistant') {
      const raw = m.metadata?.raw;
      if (typeof raw === 'string') return { role: 'assistant', content: raw };
    }
    const content = m.parts
      .filter((p): p is Extract<ChatMessagePart, { type: 'text' }> => p.type === 'text')
      .map((p) => p.text)
      .join('');
    return { role: m.role === 'assistant' ? 'assistant' : 'user', content };
  }

  const issueSig = (i: A2uiValidationIssue) =>
    `${i.code}|${i.surfaceId ?? ''}|${i.path ?? ''}|${i.message}`;

  async function runTurn(rawUserText: string) {
    if (busy) return;

    let text = rawUserText;
    // Prepend queued validation errors so the agent can repair the surface.
    if (pendingIssues.length > 0) {
      text = `[ui-error] ${JSON.stringify(pendingIssues)}\n${text}`;
      pendingIssues = [];
    }
    errorBanner = '';

    messages = [
      ...messages,
      { id: nextId(), role: 'user', parts: [{ type: 'text', text }], status: 'complete' }
    ];

    // Snapshot BEFORE the empty assistant turn; drop text-less turns (the Messages
    // API rejects empty content, which would wedge the chat).
    const history = messages.map(toWire).filter((m) => m.content.length > 0);

    const assistantId = nextId();
    const splitter = new A2uiStreamSplitter();
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
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
      });

      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => '');
        let message = body;
        try {
          message = (JSON.parse(body) as { message?: string }).message ?? body;
        } catch {
          /* keep raw body */
        }
        errorBanner = message || `Request failed (${res.status})`;
        patch(assistantId, { status: 'error' });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const lines = frame.split('\n');
          const event = lines.find((l) => l.startsWith('event: '))?.slice(7);
          const rawData = lines.find((l) => l.startsWith('data: '))?.slice(6);
          if (!event || rawData === undefined) continue;
          const data = JSON.parse(rawData) as { text?: string; message?: string };
          if (event === 'token') {
            splitter.push(data.text ?? '');
            patch(assistantId, {
              parts: splitter.snapshot() as ChatMessagePart[],
              metadata: { raw: splitter.raw }
            });
          } else if (event === 'error') {
            failed = true;
            errorBanner = data.message ?? 'stream failed';
            patch(assistantId, { status: 'error' });
          }
        }
      }

      splitter.end();
      patch(assistantId, {
        parts: splitter.snapshot() as ChatMessagePart[],
        metadata: { raw: splitter.raw },
        status: failed ? 'error' : 'complete'
      });
    } catch (err) {
      const aborted = (err as Error).name === 'AbortError';
      patch(assistantId, { status: aborted ? 'aborted' : 'error' });
      if (!aborted) errorBanner = (err as Error).message;
    } finally {
      busy = false;
      controller = undefined;
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
    const text = toWire(prior).content;
    messages = messages.slice(0, idx - 1);
    runTurn(text);
  }

  // A Button on a rendered surface → a fresh user turn carrying the action event.
  function handleAction(event: A2uiActionEvent) {
    if (busy) return;
    runTurn(`[ui-action] ${JSON.stringify(event)}`);
  }

  // Collect error-severity issues (deduped) to report on the next send.
  function handleValidationError(issues: A2uiValidationIssue[]) {
    const errs = issues.filter((i) => i.severity === 'error');
    if (errs.length === 0) return;
    const seen = new Set(pendingIssues.map(issueSig));
    const next = [...pendingIssues];
    for (const e of errs) {
      if (!seen.has(issueSig(e))) {
        seen.add(issueSig(e));
        next.push(e);
      }
    }
    pendingIssues = next;
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
    <Badge intent={busy ? 'primary' : 'neutral'} variant="soft" size="sm">
      {busy ? 'generating' : 'idle'}
    </Badge>
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
              streaming={m.status === 'streaming'}
              onAction={handleAction}
              onValidationError={handleValidationError}
            />
          {/snippet}
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
