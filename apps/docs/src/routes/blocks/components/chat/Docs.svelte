<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Full conversation surface"
      description="The header and composer stay pinned while the ChatMessageList body scrolls. You hold the messages array in $state and append to it as answers stream in."
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
      description="Put the shell in a SplitPane's start pane and a live artifact (preview, document, canvas) in the end pane. Each pane scrolls independently."
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

<Section marker id="anatomy" title="Anatomy">
  <p class="text-text-secondary text-sm leading-relaxed">
    <strong>Chat</strong> is three stacked regions:
  </p>
  <ul class="text-text-secondary mt-3 list-outside list-disc space-y-1.5 pl-5 text-sm">
    <li>
      <code class="text-text-primary">header</code> — an optional pinned bar (border-b). Put a title,
      model picker, or connection badge here. Never scrolls.
    </li>
    <li>
      <code class="text-text-primary">children</code> — the scrollable body. This is the one region
      that scrolls; drop a
      <a href={r('/blocks/components/chat-message-list')} class="text-primary hover:underline"
        >ChatMessageList</a
      >
      here.
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
    <strong>Chat fills its parent's height</strong>, so give the parent a concrete height (or place
    it in a flex/grid track that provides one). Inside, the body carries
    <code class="text-text-primary">min-h-0</code> so it can scroll instead of pushing the shell taller.
    Chat keeps no state of its own; the messages array lives in your component.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Structure, not a landmark">
      <p>
        Chat renders plain <code class="text-text-primary">&lt;div&gt;</code> regions. It adds no
        <code class="text-text-primary">role="banner"</code>,
        <code class="text-text-primary">&lt;main&gt;</code>, or
        <code class="text-text-primary">&lt;form&gt;</code> semantics, because those belong to the
        page around it. If the conversation is a standalone view, give the root an
        <code class="text-text-primary">aria-label</code> or wrap it in a labelled
        <code class="text-text-primary">&lt;section&gt;</code>.
      </p>
    </Note>
    <Note title="Meaning comes from children">
      <p>
        The accessible semantics come from what you place inside.
        <code class="text-text-primary">ChatMessageList</code> provides the scrollable
        <code class="text-text-primary">role="log"</code> region and a screen-reader status channel;
        <code class="text-text-primary">PromptInput</code> provides the labelled textarea and send/stop
        buttons. Chat itself only stacks them in order.
      </p>
    </Note>
    <Note title="Scroll ownership">
      <p>
        Because only the body scrolls, <Kbd keys="Page Up" />
        /
        <Kbd keys="Page Down" /> act on the focusable list region rather than the page, and the header
        and composer stay in view.
      </p>
    </Note>
  </NoteList>
</Section>
