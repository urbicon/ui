<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    A2UIView,
    Button,
    Card,
    urbiconA2uiCatalog,
    type A2uiActionEvent
  } from '@urbicon-ui/blocks';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { recipeMeta } from './meta';
  import RecipeHeader from '../RecipeHeader.svelte';
  import RecipeFeatures from '../RecipeFeatures.svelte';

  const { features } = recipeMeta;

  // ── Live preview ───────────────────────────────────────────────────────────
  // Real envelopes, no network: the payload below is exactly what an agent
  // streams, and A2UIView renders it exactly as it would in a chat. "Show
  // available times" appends the patch envelopes the agent would send after
  // calling its tool — the same array-append the router performs.
  const V = 'v0.9.1';
  const CATALOG = 'urbicon-ui/urbicon-catalog/v1';

  const initial: unknown[] = [
    { version: V, createSurface: { surfaceId: 'demo', catalogId: CATALOG, sendDataModel: true } },
    {
      version: V,
      updateDataModel: { surfaceId: 'demo', value: { house: ['cala'], date: '2026-09-03' } }
    },
    {
      version: V,
      updateComponents: {
        surfaceId: 'demo',
        components: [
          { id: 'root', component: 'Card', variant: 'outlined', child: 'body' },
          { id: 'body', component: 'Column', children: ['when', 'load'] },
          { id: 'when', component: 'Section', title: 'When', child: 'when-col' },
          { id: 'when-col', component: 'Column', children: ['date'] },
          { id: 'date', component: 'DatePicker', label: 'Check-in', value: { path: '/date' } },
          {
            id: 'load',
            component: 'Button',
            intent: 'secondary',
            variant: 'outlined',
            child: 'load-label',
            action: { event: { name: 'showRooms', context: { date: { path: '/date' } } } }
          },
          { id: 'load-label', component: 'Text', text: 'Show free rooms' }
        ]
      }
    }
  ];

  // What the agent sends back once its tool returned: the free rooms go into
  // the data model, and one re-sent container reveals a chooser bound to them.
  const patch: unknown[] = [
    {
      version: V,
      updateDataModel: {
        surfaceId: 'demo',
        path: '/options',
        value: [
          { label: 'Garden Room — €300', value: 'garden' },
          { label: 'Corner Room — €360', value: 'corner' },
          { label: 'Suite — €520', value: 'suite' }
        ]
      }
    },
    {
      version: V,
      updateComponents: {
        surfaceId: 'demo',
        components: [
          { id: 'when-col', component: 'Column', children: ['date', 'times'] },
          {
            id: 'times',
            component: 'RadioGroup',
            label: 'Free rooms',
            orientation: 'horizontal',
            value: { path: '/room' },
            options: { path: '/options' }
          }
        ]
      }
    }
  ];

  let payload = $state<unknown[]>(initial);
  let lastAction = $state('');
  const patched = $derived(payload.length > initial.length);

  function handleAction(event: A2uiActionEvent) {
    lastAction = event.name;
    if (event.name === 'showRooms' && !patched) {
      // Append immutably — A2UIView applies only the new envelopes, so anything
      // the user already entered survives.
      payload = [...payload, ...patch];
    }
  }

  function reset() {
    payload = initial;
    lastAction = '';
  }

  const serverCode = `import {
  a2uiDataSchemaSection,
  a2uiFencedTransportSection,
  a2uiSystemPrompt,
  urbiconA2uiCatalogSpec
} from '@urbicon-ui/blocks';

// The catalog contract, the data-model contract and the wire format all come
// from the library, so the prompt can never describe UI the renderer rejects.
// Only the domain rules are yours to write.
const system = [
  a2uiSystemPrompt({ catalog: urbiconA2uiCatalogSpec }),
  a2uiDataSchemaSection(BOOKING_SCHEMA),
  a2uiFencedTransportSection(),
  'Call get_hotel_info before you offer any room or rate. Never invent one.'
].join('\\n\\n');`;

  const recipeCode = `<script lang="ts">
  import {
    A2UIView,
    A2uiStreamSplitter,
    A2uiSurfaceRouter,
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
    type ChatMessagePart
  } from '@urbicon-ui/blocks';
  import { SvelteSet } from 'svelte/reactivity';

  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);
  let pendingIssues = $state<A2uiValidationIssue[]>([]);

  // One router per conversation: it remembers which message owns which surface.
  const router = new A2uiSurfaceRouter();
  // Messages currently receiving a patch render with streaming grace, so a
  // half-arrived patch shows placeholders instead of dangling-reference chips.
  const patchTargets = new SvelteSet<string>();

  let idSeq = 0;
  const nextId = () => \`m-\${++idSeq}\`;

  function patchMessage(id: string, next: Partial<ChatMessageData>) {
    messages = messages.map((m) => (m.id === id ? { ...m, ...next } : m));
  }

  function routeParts(messageId: string, parts: ChatMessagePart[]): ChatMessagePart[] {
    const result = routeMessageParts(router, messages, messageId, parts);
    messages = result.messages;
    for (const target of result.targets) patchTargets.add(target);
    // A re-created surfaceId is a protocol slip — report it even as a warning.
    if (result.issues.length > 0) pendingIssues = [...pendingIssues, ...result.issues];
    return result.parts;
  }

  async function send(text: string) {
    if (busy) return;
    // Queued validation issues ride along so the agent can repair its surface.
    const wire = pendingIssues.length
      ? \`[ui-error] \${JSON.stringify(pendingIssues)}\\n\${text}\`
      : text;
    pendingIssues = [];

    messages = [
      ...messages,
      { id: nextId(), role: 'user', parts: [{ type: 'text', text }], status: 'complete' }
    ];
    const history = messages.map((m) => ({
      role: m.role,
      content: (m.metadata?.raw as string) ?? text
    }));

    const assistantId = nextId();
    messages = [
      ...messages,
      { id: assistantId, role: 'assistant', parts: [], status: 'streaming' }
    ];

    // One splitter per model round: it turns the token stream into ordered
    // text / a2ui parts and buffers partial lines, so fences may straddle chunks.
    const splitter = new A2uiStreamSplitter();
    busy = true;
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [...history.slice(0, -1), { role: 'user', content: wire }] })
      });
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        splitter.push(decoder.decode(value, { stream: true }));
        // Route BEFORE storing: foreign envelopes are delivered into earlier
        // payloads, and these parts are written on top of that updated list.
        patchMessage(assistantId, {
          parts: routeParts(assistantId, splitter.snapshot() as ChatMessagePart[]),
          metadata: { raw: splitter.raw }
        });
      }
      splitter.end();
      patchMessage(assistantId, {
        parts: routeParts(assistantId, splitter.snapshot() as ChatMessagePart[]),
        metadata: { raw: splitter.raw },
        status: 'complete'
      });
    } finally {
      busy = false;
      // Patch fully arrived — hand the targets back to strict validation.
      patchTargets.clear();
    }
  }

  // A control on a rendered surface: send it back as a fresh user turn. The
  // agent usually answers by PATCHING that surface rather than sending a new one.
  function handleAction(event: A2uiActionEvent) {
    send(\`[ui-action] \${JSON.stringify(event)}\`);
  }

  function regenerate(message: ChatMessageData) {
    // Take back what the dropped turn patched into earlier messages first.
    messages = revokeMessage(router, messages, message.id);
    messages = messages.filter((m) => m.id !== message.id);
  }
<\/script>

<Chat>
  <ChatMessageList {messages}>
    {#snippet message({ message: m })}
      {#snippet a2uiPart(part: Extract<ChatMessagePart, { type: 'a2ui' }>)}
        <A2UIView
          payload={part.payload}
          streaming={m.status === 'streaming' || patchTargets.has(m.id)}
          catalogs={[urbiconA2uiCatalog]}
          dataSchema={BOOKING_SCHEMA}
          onAction={handleAction}
          onValidationError={(issues) => {
            pendingIssues = [...pendingIssues, ...issues.filter((i) => i.severity === 'error')];
          }}
        />
      {/snippet}
      <ChatMessage message={m} partRenderers={{ a2ui: a2uiPart }} />
    {/snippet}
  </ChatMessageList>

  {#snippet composer()}
    <PromptInput {busy} onSubmit={({ text }) => send(text)} />
  {/snippet}
</Chat>`;
</script>

<SeoMeta title={recipeMeta.title} description={recipeMeta.description} />

<div class="mx-auto max-w-4xl px-4 py-10">
  <RecipeHeader meta={recipeMeta} />

  <Section id="preview" title="Live Preview">
    <p class="text-text-secondary mb-4 text-sm">
      Real envelopes, no network. Pressing <strong>Show free rooms</strong> appends the patch an agent
      would send after calling its tool: the free rooms go into the data model and one re-sent container
      reveals a chooser bound to them. Nothing is rebuilt — a value you already picked survives the patch.
    </p>
    <Card variant="outlined">
      <div class="flex flex-col gap-4 p-4">
        <A2UIView {payload} catalogs={[urbiconA2uiCatalog]} onAction={handleAction} />
        <div class="border-border-subtle flex items-center gap-3 border-t pt-3">
          <Button size="sm" variant="outlined" intent="neutral" onclick={reset} disabled={!patched}>
            Reset
          </Button>
          <span class="text-text-tertiary text-xs">
            {#if lastAction}
              Last action dispatched: <code class="font-mono">{lastAction}</code>
            {:else}
              No action dispatched yet
            {/if}
          </span>
        </div>
      </div>
    </Card>
  </Section>

  <Section id="features" title="Features">
    <RecipeFeatures {features} />
  </Section>

  <Section id="server" title="Server — assembling the system prompt">
    <p class="text-text-secondary mb-4 text-sm">
      Three shipped sections plus your domain rules. The transport section is the prompt half of
      <code class="font-mono text-xs">A2uiStreamSplitter</code>, so the format the agent is told to
      write is by construction the format the client parses.
    </p>
    <CodeExample
      title="src/routes/api/chat/+server.ts"
      preview={false}
      language="ts"
      code={serverCode}
    />
  </Section>

  <Section id="client" title="Client — splitter, router, view">
    <p class="text-text-secondary mb-4 text-sm">
      The three pieces in order: the splitter turns tokens into parts, the router delivers envelopes
      to the message that owns their surface, and <code class="font-mono text-xs">A2UIView</code>
      renders one payload. See the
      <a href="https://ui.urbicon.de" class="text-primary underline">A2UI guide</a> for why a patched
      message needs streaming grace and why a plain choice must not be an action.
    </p>
    <CodeExample
      title="src/routes/chat/+page.svelte"
      preview={false}
      language="svelte"
      code={recipeCode}
    />
  </Section>
</div>
