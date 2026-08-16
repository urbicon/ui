<script lang="ts">
  import { A2UIView, Button, urbiconA2uiCatalog, type A2uiActionEvent } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { recipeMeta } from './meta';
  import RecipeShell from '../RecipeShell.svelte';

  // The seam between demo and code: the chat client below reads its envelopes
  // off a stream, the demo feeds the same wire payloads to A2UIView from these
  // fixtures. "Show free rooms" appends the patch envelopes the agent would
  // send after calling its tool — the same array-append routeMessageParts
  // performs in the client.
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

  const recipeCode = `<\script lang="ts">
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
  const nextId = () => \`msg-\${++idSeq}\`;

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

<RecipeShell meta={recipeMeta}>
  <Section id="preview" title="Live preview" titleHidden>
    <CodeExample
      title="src/routes/chat/+page.svelte"
      description="Press `Show free rooms`: the patch an agent sends after its tool call reveals a room chooser, and the date you picked survives it. The demo feeds `A2UIView` these envelopes from local fixtures; the code reads the same wire format off the chat stream."
      code={recipeCode}
      language="svelte"
      headingLevel={2}
    >
      <div class="w-full max-w-xl space-y-4">
        <A2UIView {payload} catalogs={[urbiconA2uiCatalog]} onAction={handleAction} />
        <div class="border-border-hairline flex items-center gap-3 border-t pt-3">
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
    </CodeExample>
  </Section>

  <Section id="prompt" title="The system prompt">
    <CodeExample
      title="src/routes/api/chat/+server.ts"
      description="Three shipped sections plus your domain rules. The transport section is the prompt half of `A2uiStreamSplitter`: the format the agent is told to write is the format the client parses."
      preview={false}
      language="typescript"
      code={serverCode}
      headingLevel={2}
    />
  </Section>

  <Section id="decisions" title="Two decisions">
    <NoteList>
      <Note title="Streaming grace follows the patch">
        <p>
          A patch lands in a message that completed an earlier turn, so its
          <code class="text-text-primary">status</code> is already
          <code class="text-text-primary">complete</code> and cannot flag that new envelopes are
          arriving for it. While they are, references to components still on the wire would fail
          strict validation and render fault chips. Only the router sees the delivery:
          <code class="text-text-primary">routeMessageParts</code> returns the ids it wrote into as
          <code class="text-text-primary">result.targets</code>, the page treats those messages as
          streaming, and the <code class="text-text-primary">finally</code> block returns them to strict
          validation.
        </p>
      </Note>
      <Note title="Picking a room is not an action">
        <p>
          The chooser binds its selection to the data model (<code class="text-text-primary"
            >value: {"{ path: '/room' }"}</code
          >): picking a room is instant, and nothing round-trips. Actions are reserved for the steps
          that need the agent or its tools, fetching the free rooms and committing the booking;
          because the surface was created with
          <code class="text-text-primary">sendDataModel: true</code>, the action that does fire
          carries the whole form state, read at click time. Give a control an action only when the
          agent has to react, and let everything else bind.
        </p>
      </Note>
    </NoteList>

    <p class="text-text-secondary mt-6 text-sm">
      Why an untrusted payload is safe to render, what the catalog rejects, and how the generated
      prompt stays in step with the validator: the
      <a class="text-primary hover:underline" href={resolve('/blocks/components/a2-ui-view')}
        >A2UIView</a
      > page.
    </p>
  </Section>
</RecipeShell>
