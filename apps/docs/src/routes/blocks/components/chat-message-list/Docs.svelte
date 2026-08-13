<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd } from '@urbicon-ui/blocks';
  import { r } from '$lib/route';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Streaming append"
      description="Append to the messages array, or grow the last message's text part as chunks arrive, and the list follows while the reader is at the bottom. onStickChange fires when following breaks, so you can show your own state, such as a 'following / paused' badge."
      preview={false}
      code={`<script lang="ts">
  import { ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';

  let messages = $state<ChatMessageData[]>(history);
  let following = $state(true);

  function streamChunk(id: string, chunk: string) {
    messages = messages.map((m) =>
      m.id === id
        ? { ...m, parts: [{ type: 'text', text: (m.parts[0]?.text ?? '') + chunk }] }
        : m
    );
  }
<\/script>

<ChatMessageList
  {messages}
  onStickChange={(stuck) => (following = stuck)}
/>`}
    />

    <CodeExample
      title="Load older history (prepend anchor)"
      description="Prepending older messages at the top would normally jump the viewport. The list detects the prepend and holds the scroll position, so the message you were reading stays in place as history loads above it."
      preview={false}
      code={`<script lang="ts">
  import { ChatMessageList, type ChatMessageData } from '@urbicon-ui/blocks';

  let messages = $state<ChatMessageData[]>(recent);
  let loading = $state(false);

  async function loadOlder() {
    if (loading) return;
    loading = true;
    const older = await fetchOlderPage(); // resolves to ChatMessageData[]
    messages = [...older, ...messages]; // prepend — the anchor holds your place
    loading = false;
  }
<\/script>

<div class="flex flex-col">
  <button onclick={loadOlder} disabled={loading}>Load older messages</button>
  <ChatMessageList {messages} />
</div>`}
    />

    <CodeExample
      title="Custom per-message rendering"
      description="The message snippet overrides how each entry renders. It receives message, index, and isLast. Use it for date separators, custom system notices, or a different bubble, and fall back to the default ChatMessage for the rest."
      preview={false}
      code={`<ChatMessageList {messages}>
  {#snippet message({ message, isLast })}
    {#if message.role === 'system'}
      <div class="text-center text-xs text-text-tertiary">{message.parts[0]?.text}</div>
    {:else}
      <ChatMessage
        {message}
        onRegenerate={isLast && message.role === 'assistant' ? () => regenerate(message.id) : undefined}
      />
    {/if}
  {/snippet}
</ChatMessageList>`}
    />
  </div>
</Section>

<!-- ─── Scroll engine ─── -->

<Section marker id="scroll-engine" title="Scroll engine">
  <p class="text-text-secondary text-sm leading-relaxed">
    The list adjusts the scroll position itself rather than through CSS
    <code class="text-text-primary">overflow-anchor</code>, which Safari does not support. Four
    behaviours follow from that:
  </p>
  <ul class="text-text-secondary mt-3 list-outside list-disc space-y-1.5 pl-5 text-sm">
    <li>
      <strong>Follow while at the bottom.</strong> New content keeps the viewport pinned to the latest
      message.
    </li>
    <li>
      <strong>Upward scroll breaks the follow.</strong> When you scroll away from the bottom, the list
      stops following and shows a floating jump-back pill with the count of new messages.
    </li>
    <li>
      <strong>Proximity re-stick.</strong> Scroll back near the bottom (or click the pill) and
      following resumes. <code class="text-text-primary">onStickChange</code> fires on every flip.
    </li>
    <li>
      <strong>Prepend anchoring.</strong> When older messages are added to the front, the current message
      stays in place instead of jumping.
    </li>
  </ul>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Note: rest attributes (including a raw <code class="text-text-primary">onscroll</code>) land on
    the non-scrolling root, so observe follow-state through
    <code class="text-text-primary">onStickChange</code> rather than a scroll listener.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        Why the log is <code class="text-text-primary">aria-live="off"</code>
      {/snippet}
      <p>
        The messages render inside a <code class="text-text-primary">role="log"</code> region, but
        its live channel is <strong>off</strong>. A streaming answer changes the DOM dozens of times
        a second; a polite or assertive log would announce every token, so the log stays silent.
      </p>
    </Note>
    <Note title="The separate status region">
      <p>
        Announcements come instead from a visually hidden
        <code class="text-text-primary">role="status"</code> region that carries only the meaningful
        transitions: <code class="text-text-primary">generatingLabel</code> once when an assistant
        message starts streaming, and the settled answer once when it completes (or
        <code class="text-text-primary">errorLabel</code> /
        <code class="text-text-primary">abortedLabel</code> for a failed stream). Screen-reader users
        hear "generating…", then the final answer, rather than each token.
      </p>
    </Note>
    <Note>
      {#snippet titleSnippet()}
        Scrollable region is focusable
      {/snippet}
      <p>
        The viewport is a labelled <code class="text-text-primary">role="region"</code>
        (<code class="text-text-primary">listLabel</code>) with
        <code class="text-text-primary">tabindex="0"</code>, so keyboard users can focus the
        conversation and scroll it with the arrow /
        <Kbd keys="Page" />
        keys. Its focus ring uses <code class="text-text-primary">focus-visible:</code> (keyboard-only).
      </p>
    </Note>
    <Note title="The jump-back button">
      <p>
        The floating pill is a real <code class="text-text-primary">&lt;button&gt;</code> whose
        <code class="text-text-primary">aria-label</code> carries the pending count (<code
          class="text-text-primary">newMessagesLabel</code
        >) or falls back to
        <code class="text-text-primary">scrollToBottomLabel</code> when nothing is pending, so its purpose
        is announced rather than implied by an icon.
      </p>
    </Note>
  </NoteList>
</Section>
