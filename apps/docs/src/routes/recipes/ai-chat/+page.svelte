<script lang="ts">
  import {
    Badge,
    Card,
    Chat,
    ChatMessageList,
    type ChatMessageData,
    PromptInput
  } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // ── The demo stages the transport, nothing else ────────────────────────────
  // The recipe code is the real client: fetch to the SSE endpoint below, a
  // ReadableStream reader, an AbortController behind Stop. This page replays
  // canned answers on a timer instead, so the demo runs offline and
  // deterministic. Markup, components, handler names and the in-place patch are
  // shared with the recipe code; only the bodies of send, stop and regenerate
  // swap the network for the timer. The elevated Card around the chat is recipe
  // content, not docs chrome: Chat scrolls only its log, so it needs a bounded
  // box, and demo and code carry the same one.

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
  const nextId = () => 'm-' + ++idSeq;

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

  function send({ text }: { text: string }) {
    messages = [
      ...messages,
      {
        id: nextId(),
        role: 'user',
        parts: [{ type: 'text', text }],
        status: 'complete'
      }
    ];
    setTimeout(() => streamReply(nextReply()), 300);
  }

  function stop() {
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

  const recipeCode = `<\script lang="ts">
  import {
    Badge,
    Card,
    Chat,
    ChatMessageList,
    type ChatMessageData,
    PromptInput
  } from '@urbicon-ui/blocks';

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
    // Snapshot BEFORE the empty assistant turn — and drop text-less turns: a
    // stream stopped before its first token leaves an empty assistant message,
    // and the Messages API rejects empty content (the chat would stay wedged).
    const history = messages.map(toWire).filter((m) => m.content.length > 0);
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

<!-- The chat needs a bounded box: Chat pins header and composer and scrolls
     only the log, so the height must come from the host. Here that host is an
     elevated Card — padding="none" hands the edges to the chat, overflow-hidden
     clips the log to the card's rounding, and the content slot runs full
     height. Centre it in your page's own layout and swap h-[34rem] for the
     height it should fill there. -->
<Card
  variant="elevated"
  padding="none"
  class="h-[34rem] max-w-3xl overflow-hidden"
  slotClasses={{ content: 'h-full' }}
>
  <Chat>
    {#snippet header()}
      <div class="flex items-center gap-2 px-4 py-2.5">
        <span class="text-text-primary text-sm font-medium">AI Assistant</span>
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
        <PromptInput {busy} placeholder="Ask anything…" onSubmit={send} onStop={stop} />
      </div>
    {/snippet}
  </Chat>
</Card>`;

  const serverCode = `import Anthropic from '@anthropic-ai/sdk';
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
</script>

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="ChatPage.svelte"
      description="Send a message, then scroll up mid-stream or press Stop. The reply is staged from canned text so the demo runs offline; the code is what your app ships, streaming from the endpoint below."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <Card
        variant="elevated"
        padding="none"
        class="h-[34rem] max-w-3xl overflow-hidden"
        slotClasses={{ content: 'h-full' }}
      >
        <Chat>
          {#snippet header()}
            <div class="flex items-center gap-2 px-4 py-2.5">
              <span class="text-text-primary text-sm font-medium">AI Assistant</span>
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
              <PromptInput {busy} placeholder="Ask anything…" onSubmit={send} onStop={stop} />
            </div>
          {/snippet}
        </Chat>
      </Card>
    </CodeExample>
  </Section>

  <Section id="server" title="The SSE endpoint">
    <CodeExample
      title="src/routes/api/chat/+server.ts"
      description="The other half of `send`: it takes the history as a POST body and answers with the `token`, `done` and `error` frames the reader above parses."
      preview={false}
      language="typescript"
      code={serverCode}
      headingLevel={2}
    />
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="POST and a stream reader, not EventSource">
        <p>
          The conversation travels as the request body, and
          <code class="text-text-primary">EventSource</code> can only GET, so the client posts with
          <code class="text-text-primary">fetch</code> and parses the SSE frames from
          <code class="text-text-primary">res.body</code> itself. The same choice wires Stop end to
          end: <code class="text-text-primary">controller.abort()</code> cancels the fetch,
          <code class="text-text-primary">request.signal</code> fires in the route, and the route hands
          the abort on to the model stream.
        </p>
      </Note>
      <Note title="Why not createStreamHandler">
        <p>
          <code class="text-text-primary">@urbicon-ui/auth</code> ships
          <code class="text-text-primary">createStreamHandler</code>, and it is tempting here. It is
          the wrong shape: a GET-only notification fan-out on an
          <code class="text-text-primary">SSEManager</code>, pushing events to every subscribed
          client. A chat relay is the opposite, one POST carrying the history answered by one
          stream, so the route is written by hand.
        </p>
      </Note>
    </NoteList>
  </Section>
</RecipeShell>
