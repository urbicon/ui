<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    Badge,
    Card,
    Chat,
    ChatMessageList,
    type ChatMessageData,
    PromptInput
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';

  const { components: usedComponents, features } = recipeMeta;

  // ── Live preview: a deterministic fixture replay, no network ────────────────
  // The recipe CODE below streams from a real SSE endpoint. This on-page demo
  // replays canned answers on a timer so the preview is reproducible offline —
  // but it exercises the exact same surface (Chat + ChatMessageList +
  // PromptInput) and the exact same in-place-append + abort state machine.

  const REPLIES = [
    `Streaming works in two hops. The **server** relays the model's token stream as \`text/event-stream\`; the **client** reads that response as a \`ReadableStream\` and appends each token to the last assistant message in place.

Scroll up while I type — the list stops following and shows a jump-back pill. Press **Stop** to abort mid-stream.`,
    `\`ChatMessageData\` is the whole contract: \`{ id, role, parts, status }\`. A plain answer is one \`{ type: 'text' }\` part. The consumer owns the array — components never mutate it.

- \`status: 'streaming'\` drives the live cursor
- \`'complete'\` settles the message
- \`'aborted'\` / \`'error'\` switch to the failure presentation with a Retry action`,
    `Use a POST + \`ReadableStream\` reader, **not** \`EventSource\` — you need a request body (the message history) and \`EventSource\` is GET-only. An \`AbortController\` wired to \`fetch\`'s \`signal\` lets **Stop** cancel the request, and the endpoint forwards that abort to the model stream.`
  ];

  // Break a reply into 1–3 token chunks, close to how model output arrives.
  function chunksOf(text: string): string[] {
    const tokens = text.split(/(?<=\s)/);
    const out: string[] = [];
    for (let i = 0; i < tokens.length;) {
      const take = 1 + ((i * 7) % 3);
      out.push(tokens.slice(i, i + take).join(''));
      i += take;
    }
    return out;
  }

  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);
  let replyIndex = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  let idSeq = 0;
  const nextId = () => `demo-${++idSeq}`;

  function patch(id: string, next: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...next } : m));
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function streamReply(text: string) {
    const id = nextId();
    const chunks = chunksOf(text);
    let pos = 0;
    busy = true;
    messages = [
      ...messages,
      { id, role: 'assistant', parts: [{ type: 'text', text: '' }], status: 'streaming' }
    ];
    timer = setInterval(() => {
      pos += 1;
      const done = pos >= chunks.length;
      patch(id, {
        parts: [{ type: 'text', text: chunks.slice(0, pos).join('') }],
        status: done ? 'complete' : 'streaming'
      });
      if (done) {
        stopTimer();
        busy = false;
      }
    }, 40);
  }

  function nextReply(): string {
    const reply = REPLIES[replyIndex % REPLIES.length];
    replyIndex += 1;
    return reply;
  }

  function handleSubmit(payload: { text: string }) {
    messages = [
      ...messages,
      {
        id: nextId(),
        role: 'user',
        parts: [{ type: 'text', text: payload.text }],
        status: 'complete'
      }
    ];
    setTimeout(() => streamReply(nextReply()), 300);
  }

  function handleStop() {
    stopTimer();
    busy = false;
    const last = messages[messages.length - 1];
    if (last?.status === 'streaming') patch(last.id, { status: 'aborted' });
  }

  function regenerate(message: ChatMessageData) {
    if (busy) return;
    const idx = messages.findIndex((m) => m.id === message.id);
    if (idx < 0) return;
    messages = messages.slice(0, idx);
    setTimeout(() => streamReply(nextReply()), 200);
  }

  $effect(() => () => stopTimer());

  // ── Recipe code (server + client) ──────────────────────────────────────────

  const serverCode = `// src/routes/api/chat/+server.ts
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import type { RequestHandler } from './$types';

const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// The client posts the flattened history. Any LLM stream works here — swap the
// SDK call for your provider; only the token-forwarding shape below matters.
interface WireMessage {
  role: 'user' | 'assistant';
  content: string;
}

export const POST: RequestHandler = async ({ request }) => {
  const { messages } = (await request.json()) as { messages: WireMessage[] };

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode('event: ' + event + '\\ndata: ' + JSON.stringify(data) + '\\n\\n')
        );

      try {
        const run = client.messages.stream({
          model: 'claude-opus-4-8',
          max_tokens: 4096,
          messages
        });

        // Forward the client's abort straight through to the model stream.
        request.signal.addEventListener('abort', () => run.abort());

        run.on('text', (delta) => send('token', { text: delta }));
        await run.finalMessage();
        send('done', {});
      } catch (err) {
        send('error', { message: err instanceof Error ? err.message : 'stream failed' });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    }
  });
};`;

  const clientCode = `<script lang="ts">
  import { Chat, ChatMessageList, PromptInput, type ChatMessageData } from '@urbicon-ui/blocks';

  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);
  let controller: AbortController | undefined;

  let idSeq = 0;
  const nextId = () => 'm-' + ++idSeq;

  // In-place patch: replace one message by id — never mutate the array element,
  // or the streaming re-render loses its identity.
  function patch(id: string, next: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...next } : m));
  }

  // Flatten a message to the wire shape the endpoint expects (text parts only).
  function toWire(m: ChatMessageData) {
    const content = m.parts
      .filter((p) => p.type === 'text')
      .map((p) => (p as { text: string }).text)
      .join('');
    return { role: m.role, content };
  }

  async function send({ text }: { text: string; attachments: unknown[] }) {
    messages = [
      ...messages,
      { id: nextId(), role: 'user', parts: [{ type: 'text', text }], status: 'complete' }
    ];

    const assistantId = nextId();
    const history = messages.map(toWire); // snapshot BEFORE the empty assistant turn
    messages = [
      ...messages,
      { id: assistantId, role: 'assistant', parts: [{ type: 'text', text: '' }], status: 'streaming' }
    ];

    busy = true;
    controller = new AbortController();

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: controller.signal
      });
      if (!res.body) throw new Error('no stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answer = '';
      let failed = false;

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE frames are separated by a blank line.
        const frames = buffer.split('\\n\\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) {
          const lines = frame.split('\\n');
          const event = lines.find((l) => l.startsWith('event: '))?.slice(7);
          const raw = lines.find((l) => l.startsWith('data: '))?.slice(6);
          if (!event || !raw) continue;
          const data = JSON.parse(raw);
          if (event === 'token') {
            answer += data.text;
            patch(assistantId, { parts: [{ type: 'text', text: answer }] });
          } else if (event === 'error') {
            // The stream still ends normally after this frame — remember the
            // failure so the final settle below cannot overwrite it.
            failed = true;
            patch(assistantId, { status: 'error' });
          }
        }
      }
      if (!failed) patch(assistantId, { status: 'complete' });
    } catch (err) {
      // AbortError → the user pressed Stop; anything else is a real failure.
      patch(assistantId, { status: (err as Error).name === 'AbortError' ? 'aborted' : 'error' });
    } finally {
      busy = false;
      controller = undefined;
    }
  }

  function stop() {
    controller?.abort();
  }

  function regenerate(message: ChatMessageData) {
    if (busy) return;
    // Drop the assistant turn (and the user turn before it) and re-send.
    const idx = messages.findIndex((m) => m.id === message.id);
    const prior = messages[idx - 1];
    if (prior?.role !== 'user') return;
    const text = toWire(prior).content;
    messages = messages.slice(0, idx - 1);
    send({ text, attachments: [] });
  }
<\/script>

<div class="h-[40rem] overflow-hidden rounded-contain border border-border-default">
  <Chat>
    {#snippet header()}
      <div class="px-4 py-2.5 text-sm font-medium text-text-primary">AI Assistant</div>
    {/snippet}

    <ChatMessageList {messages} onRegenerate={regenerate} onRetry={regenerate} />

    {#snippet composer()}
      <div class="p-3">
        <PromptInput {busy} placeholder="Ask anything…" onSubmit={send} onStop={stop} />
      </div>
    {/snippet}
  </Chat>
</div>`;
</script>

<SeoMeta
  title="AI Chat Recipe"
  description="A complete streaming chat surface on Urbicon UI — Chat shell, ChatMessageList, and PromptInput wired to a SvelteKit SSE endpoint relaying a Claude/LLM stream."
/>

<div class="mx-auto max-w-5xl px-6 py-12">
  <header class="mb-10">
    <a
      href={resolve('/recipes')}
      class="mb-4 inline-flex items-center gap-1 text-sm text-text-tertiary transition-colors hover:text-text-primary"
    >
      ← Back to Recipes
    </a>
    <h1 class="mb-3 text-4xl font-bold text-text-primary">{recipeMeta.title}</h1>
    <p class="text-lg text-text-secondary">{recipeMeta.description}</p>
  </header>

  <div class="mb-8 flex flex-wrap gap-2">
    {#each usedComponents as comp (comp)}
      <Badge variant="soft" intent="primary">{comp}</Badge>
    {/each}
  </div>

  <Section id="preview" title="Live Preview">
    <p class="mb-4 text-sm text-text-secondary">
      This preview replays canned answers on a timer — no network — so it is reproducible offline.
      The <a href={resolve('/recipes/ai-chat')} class="text-primary underline">code below</a>
      streams from a real SSE endpoint, but drives the same surface and the same append/abort state
      machine. Send a message, then scroll up mid-stream or press <strong>Stop</strong>.
    </p>
    <Card variant="outlined">
      <div class="p-4">
        <div class="h-[34rem] overflow-hidden rounded-contain border border-border-default">
          <Chat>
            {#snippet header()}
              <div class="flex items-center gap-2 px-4 py-2.5">
                <span class="text-sm font-medium text-text-primary">AI Assistant</span>
                <Badge intent={busy ? 'primary' : 'neutral'} variant="soft" size="sm">
                  {busy ? 'streaming' : 'idle'}
                </Badge>
              </div>
            {/snippet}

            <ChatMessageList
              {messages}
              onRegenerate={regenerate}
              onRetry={regenerate}
              emptyTitle="Start the conversation"
              emptyDescription="Send a message to watch a reply stream in."
            />

            {#snippet composer()}
              <div class="p-3">
                <PromptInput
                  {busy}
                  placeholder="Ask anything…"
                  onSubmit={handleSubmit}
                  onStop={handleStop}
                />
              </div>
            {/snippet}
          </Chat>
        </div>
      </div>
    </Card>
  </Section>

  <Section id="features" title="Features">
    <Card variant="outlined">
      <ul class="divide-y divide-border-subtle">
        {#each features as feature (feature)}
          <li class="px-4 py-3 text-sm text-text-secondary">{feature}</li>
        {/each}
      </ul>
    </Card>
  </Section>

  <Section id="server" title="Server — the SSE endpoint">
    <p class="mb-4 text-sm text-text-secondary">
      A plain SvelteKit <code class="font-mono text-xs">+server.ts</code> that relays the model
      stream as <code class="font-mono text-xs">text/event-stream</code>. (The
      <code class="font-mono text-xs">@urbicon-ui/auth</code> package ships
      <code class="font-mono text-xs">createStreamHandler</code>, but that is a
      <em>notification</em> SSE fan-out — GET-only, backed by an
      <code class="font-mono text-xs">SSEManager</code> — not an LLM chat relay, which needs a POST body.
      Write the endpoint directly, as here.)
    </p>
    <CodeExample
      title="src/routes/api/chat/+server.ts"
      preview={false}
      language="ts"
      code={serverCode}
    />
  </Section>

  <Section id="client" title="Client — the chat page">
    <CodeExample
      title="src/routes/chat/+page.svelte"
      preview={false}
      language="svelte"
      code={clientCode}
    />
  </Section>
</div>
