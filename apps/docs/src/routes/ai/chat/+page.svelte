<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    A2UIView,
    URBICON_A2UI_CATALOG_ID,
    urbiconA2uiCatalog,
    type A2uiActionEvent,
    Badge,
    Button,
    Chat,
    ChatMessageList,
    type ChatMessageData,
    type ChatMessagePart,
    PromptInput,
    Select
  } from '@urbicon-ui/blocks';

  // ── Simulated model replies (rotating) ─────────────────────────────────────

  interface ReplyPlan {
    pre: ChatMessagePart[];
    text: string;
    /**
     * Optional A2UI envelope sequence. When present, the reply carries an `a2ui`
     * part whose payload grows one envelope per few ticks — the same immutable
     * `[...prev, envelope]` extension a real JSONL stream would do — so the
     * surface renders progressively (dangling refs are skeletons while
     * streaming). Rendered via `partRenderers.a2ui` → A2UIView.
     */
    a2ui?: unknown[];
  }

  const REPLIES: ReplyPlan[] = [
    {
      pre: [],
      text: `Here is a quick comparison of the scroll models:

| Model | Container | Best for |
| --- | --- | --- |
| Page-relative | the document | long reads |
| Contained | \`fit="viewport"\` | dashboards |

The engine follows new content **only while you are at the bottom** — scroll up and it stops, with a jump-back button appearing instead.

\`\`\`ts
const list = messages.filter((m) => m.role !== 'system');
\`\`\`

1. Streamed markdown settles block by block
2. Settled blocks never re-render
3. The tail is repaired on every chunk`
    },
    {
      pre: [
        {
          type: 'reasoning',
          text: 'The user wants sources. I should look up the attention paper and the scaling-laws work, then cite both inline.',
          durationMs: 2400
        },
        {
          type: 'tool-call',
          id: 'tc-search',
          name: 'search_papers',
          state: 'running',
          input: { query: 'transformer attention scaling laws' }
        },
        {
          type: 'source',
          id: '1',
          title: 'Attention Is All You Need',
          url: 'https://arxiv.org/abs/1706.03762',
          snippet: 'We propose a new simple network architecture, the Transformer.'
        },
        {
          type: 'source',
          id: '2',
          title: 'Scaling Laws for Neural Language Models',
          url: 'https://arxiv.org/abs/2001.08361',
          snippet: 'Performance improves smoothly with model size, data and compute.'
        }
      ],
      text: `The Transformer architecture replaced recurrence with self-attention [1], and later work showed that its performance scales predictably with compute [2].

Both citations resolve to chips — open one to see the title, snippet, and the policy-checked source link.`
    },
    {
      pre: [],
      text: `Good plan. Suggested next steps:

- [x] Wire the message list to your stream
- [x] Pass \`sources\` so \`[n]\` markers become chips
- [x] Tool calls render as \`ToolCallCard\`, reasoning as \`ReasoningDisclosure\` — override via \`partRenderers\`

> Tip: press **Stop** while I stream to see the aborted state with its Retry action.`
    },
    {
      pre: [],
      text: `Sure — here's a quick booking form. Fill it in and I'll take it from there:`,
      // A2UI: the agent emits a UI as data, not code. The envelopes arrive over
      // several ticks so the surface renders progressively; A2UIView validates
      // every one against the trusted catalog before anything reaches the DOM.
      a2ui: [
        {
          version: 'v0.9.1',
          createSurface: { surfaceId: 'chat-form', catalogId: URBICON_A2UI_CATALOG_ID }
        },
        {
          version: 'v0.9.1',
          updateComponents: {
            surfaceId: 'chat-form',
            components: [
              { id: 'root', component: 'Card', child: 'col' },
              { id: 'col', component: 'Column', children: ['title', 'name', 'email', 'submit'] }
            ]
          }
        },
        {
          version: 'v0.9.1',
          updateComponents: {
            surfaceId: 'chat-form',
            components: [
              { id: 'title', component: 'Text', text: 'Book a demo', variant: 'h4' },
              { id: 'name', component: 'Input', label: 'Name', value: { path: '/name' } }
            ]
          }
        },
        {
          version: 'v0.9.1',
          updateComponents: {
            surfaceId: 'chat-form',
            components: [
              {
                id: 'email',
                component: 'Input',
                label: 'Work email',
                inputType: 'email',
                value: { path: '/email' }
              },
              { id: 'submit-label', component: 'Text', text: 'Request access' },
              {
                id: 'submit',
                component: 'Button',
                intent: 'primary',
                child: 'submit-label',
                action: {
                  event: {
                    name: 'book_demo',
                    context: { name: { path: '/name' }, email: { path: '/email' } }
                  }
                }
              }
            ]
          }
        },
        {
          version: 'v0.9.1',
          updateDataModel: { surfaceId: 'chat-form', value: { name: '', email: '' } }
        }
      ]
    }
  ];

  // Word-ish chunks of 1–3 tokens — close to how model output arrives.
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

  // ── Conversation state ─────────────────────────────────────────────────────

  let idCounter = 0;
  const nextId = () => `demo-${++idCounter}`;

  const SEED: ChatMessageData[] = [
    {
      id: nextId(),
      role: 'user',
      parts: [{ type: 'text', text: 'How does the streaming markdown renderer work?' }],
      createdAt: new Date(Date.now() - 90_000)
    },
    {
      id: nextId(),
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: 'It parses the growing string into a **component tree** — no `{@html}` anywhere. Settled blocks are cached by identity, so during streaming only the tail block re-renders, and a strict URL policy checks every link before it can reach the DOM.'
        }
      ],
      createdAt: new Date(Date.now() - 80_000),
      status: 'complete'
    }
  ];

  let messages = $state<ChatMessageData[]>([...SEED]);
  let busy = $state(false);
  // Couples the a2ui part's `streaming` flag to the assistant message's status:
  // true exactly while the UI-bearing reply is still appending envelopes, so
  // dangling child references render skeletons rather than fault chips. The part
  // snippet only receives the part, so this shared flag is how it learns the
  // owning message is still streaming (only one such reply streams at a time).
  let a2uiStreaming = $state(false);
  let following = $state(true);
  let layout = $state<'bubble' | 'plain'>('bubble');
  let replyIndex = 0;
  let historyBatch = 0;
  let timer: ReturnType<typeof setInterval> | undefined;

  function patchMessage(id: string, patch: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...patch } : m));
  }

  function stopTimer() {
    if (timer) clearInterval(timer);
    timer = undefined;
  }

  function streamReply(reply: ReplyPlan) {
    const id = nextId();
    const chunks = chunksOf(reply.text);
    const envelopes = reply.a2ui ?? [];
    const hasUi = envelopes.length > 0;
    let pos = 0;
    let uiCount = 0;
    busy = true;
    a2uiStreaming = hasUi;
    messages = [
      ...messages,
      { id, role: 'assistant', parts: [...reply.pre], createdAt: new Date(), status: 'streaming' }
    ];
    timer = setInterval(() => {
      pos += 1;
      // Append one A2UI envelope every 4 ticks — the payload grows immutably,
      // so A2UIView applies only the new envelope and the surface fills in.
      if (hasUi && uiCount < envelopes.length && pos % 4 === 0) uiCount += 1;
      const textDone = pos >= chunks.length;
      const uiDone = !hasUi || uiCount >= envelopes.length;
      const done = textDone && uiDone;
      // running tool calls "complete" once the answer text starts flowing
      const pre = reply.pre.map((p) =>
        p.type === 'tool-call' && pos > 4
          ? { ...p, state: 'complete' as const, output: { hits: 2 } }
          : p
      );
      const text = chunks.slice(0, pos).join('');
      const uiPart: ChatMessagePart[] = hasUi
        ? [{ type: 'a2ui', payload: envelopes.slice(0, uiCount) }]
        : [];
      patchMessage(id, {
        parts: [...pre, { type: 'text', text }, ...uiPart],
        status: done ? 'complete' : 'streaming'
      });
      if (done) {
        stopTimer();
        busy = false;
        a2uiStreaming = false;
      }
    }, 33);
  }

  // A Button inside a rendered A2UI surface dispatches a spec-exact action event.
  // Surface it as a visible user turn (a compact [ui-action] JSON text part), the
  // way an app would relay it back to the agent, then let the copilot respond.
  function handleUiAction(event: A2uiActionEvent) {
    messages = [
      ...messages,
      {
        id: nextId(),
        role: 'user',
        parts: [{ type: 'text', text: `[ui-action] ${JSON.stringify(event)}` }],
        createdAt: new Date(),
        status: 'complete'
      }
    ];
    setTimeout(() => streamReply(nextReply()), 350);
  }

  function nextReply(): ReplyPlan {
    const reply = REPLIES[replyIndex % REPLIES.length];
    replyIndex += 1;
    return reply;
  }

  function handleSubmit(payload: { text: string; attachments: { file: File }[] }) {
    const parts: ChatMessagePart[] = [];
    if (payload.text) parts.push({ type: 'text', text: payload.text });
    for (const a of payload.attachments) {
      parts.push({
        type: 'attachment',
        name: a.file.name,
        mimeType: a.file.type,
        size: a.file.size
      });
    }
    messages = [
      ...messages,
      { id: nextId(), role: 'user', parts, createdAt: new Date(), status: 'complete' }
    ];
    setTimeout(() => streamReply(nextReply()), 350);
  }

  function handleStop() {
    stopTimer();
    busy = false;
    // Also settle the shared streaming flag: leaving it true would keep any
    // dangling A2UI reference stuck as a skeleton instead of a fault chip.
    a2uiStreaming = false;
    const last = messages[messages.length - 1];
    if (last?.status === 'streaming') patchMessage(last.id, { status: 'aborted' });
  }

  function regenerate(message: ChatMessageData) {
    if (busy) return;
    messages = messages.filter((m) => m.id !== message.id);
    streamReply(nextReply());
  }

  function loadOlderHistory() {
    historyBatch += 1;
    const older: ChatMessageData[] = [];
    for (let i = 3; i >= 1; i--) {
      older.push(
        {
          id: `history-${historyBatch}-${i}-q`,
          role: 'user',
          parts: [
            { type: 'text', text: `Earlier question ${historyBatch}.${i}: how do presets work?` }
          ]
        },
        {
          id: `history-${historyBatch}-${i}-a`,
          role: 'assistant',
          parts: [
            {
              type: 'text',
              text: `Earlier answer ${historyBatch}.${i}: register the look once on \`BlocksProvider\` and reference it by name — the scroll anchor keeps this message exactly where it was while history loads above.`
            }
          ],
          status: 'complete'
        }
      );
    }
    messages = [...older, ...messages];
  }

  $effect(() => {
    return () => stopTimer();
  });
</script>

<SeoMeta
  title="Chat Playground"
  description="The full AI-kit conversation surface: ChatMessageList's stick-to-bottom scroll engine, streaming ChatMessage parts (reasoning, tool calls, citations), and the PromptInput composer with attachments."
/>

<div class="mx-auto max-w-5xl px-4 py-10">
  <div class="mb-6 flex items-center gap-3">
    <h1 class="text-text-primary text-2xl font-semibold">Chat Playground</h1>
    <Badge intent="warning" variant="soft">experimental</Badge>
  </div>
  <p class="text-text-secondary mb-8 max-w-3xl">
    The whole P2 conversation stack, live: send a message and a simulated model reply streams
    through <code class="font-mono text-sm">StreamingMarkdown</code>. Scroll up mid-stream to break
    the follow behaviour and get the jump-back pill; load older history to watch the scroll anchor
    hold your place; press <strong>Stop</strong> to see the aborted state; attach an image to see the
    intake chips become attachment parts.
  </p>

  <!--
    A2UIView is not a default part renderer — it is opted in here per surface so
    it stays out of the base conversation bundle. Declared at template scope (not
    inside <Chat>, where it would become a Chat prop) so ChatMessageList can
    reference it; ChatMessageList forwards partRenderers to every ChatMessage.
  -->
  {#snippet a2uiPart(part: Extract<ChatMessagePart, { type: 'a2ui' }>)}
    <div class="my-1 max-w-sm">
      <A2UIView
        payload={part.payload}
        streaming={a2uiStreaming}
        catalogs={[urbiconA2uiCatalog]}
        onAction={handleUiAction}
      />
    </div>
  {/snippet}

  <div class="rounded-contain border-border-default h-[44rem] overflow-hidden border">
    <Chat>
      {#snippet header()}
        <div class="flex flex-wrap items-center gap-3 px-4 py-2.5">
          <span class="text-text-primary text-sm font-medium">Support copilot</span>
          <Badge intent={following ? 'success' : 'neutral'} variant="soft" size="sm">
            {following ? 'following' : 'paused'}
          </Badge>
          <div class="ms-auto flex items-center gap-2">
            <Select
              label="Layout"
              options={[
                { value: 'bubble', label: 'Bubble layout' },
                { value: 'plain', label: 'Plain layout' }
              ]}
              value={layout}
              onValueChange={(v: string | null) => {
                if (v === 'bubble' || v === 'plain') layout = v;
              }}
              size="sm"
              class="w-40"
            />
            <Button variant="outlined" size="sm" onclick={loadOlderHistory}>Load older</Button>
          </div>
        </div>
      {/snippet}

      <ChatMessageList
        {messages}
        {layout}
        partRenderers={{ a2ui: a2uiPart }}
        onRegenerate={regenerate}
        onRetry={regenerate}
        onStickChange={(stuck) => (following = stuck)}
      />

      {#snippet composer()}
        <div class="p-3">
          <PromptInput
            {busy}
            allowAttachments
            accept="image/*"
            maxFiles={4}
            placeholder="Ask the copilot…"
            onSubmit={handleSubmit}
            onStop={handleStop}
          />
        </div>
      {/snippet}
    </Chat>
  </div>
</div>
