<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { r } from '$lib/route';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Full conversation surface"
      description="The canonical composition — the header and composer stay pinned while the ChatMessageList body owns the scroll. The consumer holds the messages array as $state and appends to it; ChatMessageList and PromptInput handle follow-scroll and input on their own."
      preview={false}
      code={`<script lang="ts">
  import { Chat, ChatMessageList, PromptInput, type ChatMessageData } from '@urbicon-ui/blocks';

  let messages = $state<ChatMessageData[]>([]);
  let busy = $state(false);

  async function handleSubmit({ text }: { text: string }) {
    messages = [
      ...messages,
      { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text }], status: 'complete' }
    ];
    // …call your transport, append an assistant message, then stream
    // its text part in as chunks arrive (see the live playground).
  }
<\/script>

<!-- Chat fills its parent — give that parent a height. -->
<div class="h-[40rem]">
  <Chat>
    {#snippet header()}
      <div class="px-4 py-2.5 text-sm font-medium text-text-primary">Support copilot</div>
    {/snippet}

    <ChatMessageList {messages} />

    {#snippet composer()}
      <div class="p-3">
        <PromptInput {busy} placeholder="Ask anything…" onSubmit={handleSubmit} />
      </div>
    {/snippet}
  </Chat>
</div>`}
    />

    <CodeExample
      title="Chat beside an artifact panel"
      description="Drop the whole shell into a SplitPane's start pane and render a live artifact (preview, document, canvas) in the end pane. Each pane clips its own overflow, so the conversation and the artifact scroll independently."
      preview={false}
      code={`<script lang="ts">
  import { SplitPane, Chat, ChatMessageList, PromptInput } from '@urbicon-ui/blocks';

  let split = $state(0.55);
  // messages / handleSubmit as in the composition example above
<\/script>

<div class="h-[40rem]">
  <SplitPane bind:ratio={split} min="30%" max="70%">
    {#snippet start()}
      <Chat>
        {#snippet header()}
          <div class="px-4 py-2.5 text-sm font-medium text-text-primary">Assistant</div>
        {/snippet}
        <ChatMessageList {messages} />
        {#snippet composer()}
          <div class="p-3"><PromptInput onSubmit={handleSubmit} /></div>
        {/snippet}
      </Chat>
    {/snippet}

    {#snippet end()}
      <div class="h-full overflow-auto bg-surface-elevated p-6">
        <h2 class="text-sm font-semibold text-text-primary">Preview</h2>
        <!-- rendered artifact… -->
      </div>
    {/snippet}
  </SplitPane>
</div>`}
    />
  </div>
</Section>

<!-- ─── Anatomy ─── -->

<Section marker="02" id="anatomy" title="Anatomy">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Chat</strong> is deliberately thin: three stacked regions and nothing else.
  </p>
  <ul class="text-text-secondary mt-3 list-inside list-disc space-y-1.5 text-sm">
    <li>
      <code class="text-text-primary">header</code> — an optional pinned bar (border-b). Put a title,
      model picker, or connection badge here. Never scrolls.
    </li>
    <li>
      <code class="text-text-primary">children</code> — the scrollable body. Drop a
      <a href={r('/blocks/components/chat-message-list')} class="text-primary hover:underline"
        >ChatMessageList</a
      >
      here; <em>it</em> is the one element that scrolls, not the shell.
    </li>
    <li>
      <code class="text-text-primary">composer</code> — an optional pinned footer (border-t) — e.g.
      a
      <a href={r('/blocks/components/prompt-input')} class="text-primary hover:underline"
        >PromptInput</a
      >. Never scrolls.
    </li>
  </ul>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    The shell is a full-height flex column with <code class="text-text-primary">min-h-0</code> on
    the body, so the body can shrink below its content and delegate overflow to its scrollable
    child. Because of that, <strong>Chat fills its parent's height</strong> — give the parent a concrete
    height (or put it inside another flex/grid track that does). Chat holds no state and opens no context;
    the conversation array lives entirely in the consumer.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Structure, not a landmark">
      <p>
        Chat renders plain <code class="text-text-primary">&lt;div&gt;</code> regions — it does not
        impose <code class="text-text-primary">role="banner"</code>,
        <code class="text-text-primary">&lt;main&gt;</code> or
        <code class="text-text-primary">&lt;form&gt;</code> semantics, because those belong to the
        page around it and the children within it. Rest attributes land on the root, so if the
        conversation is a standalone view, name it — pass
        <code class="text-text-primary">aria-label</code> or wrap it in a labelled
        <code class="text-text-primary">&lt;section&gt;</code>.
      </p>
    </Note>
    <Note title="Meaning comes from children">
      <p>
        The accessible semantics are supplied by what you place inside:
        <code class="text-text-primary">ChatMessageList</code> exposes the scrollable
        <code class="text-text-primary">role="log"</code> region plus a screen-reader status
        channel, and <code class="text-text-primary">PromptInput</code> ships the labelled textarea and
        send/stop buttons. Chat only guarantees they stack in the right order.
      </p>
    </Note>
    <Note title="Scroll ownership">
      <p>
        Because only the body scrolls, keyboard scrolling (<kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Page&nbsp;Up</kbd
        >
        /
        <kbd
          class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
          >Page&nbsp;Down</kbd
        >) lands on the focusable list region, never on the page — while the header and composer
        stay reachable and in view.
      </p>
    </Note>
  </NoteList>
</Section>
