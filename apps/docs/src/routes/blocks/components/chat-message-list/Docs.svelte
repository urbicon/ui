<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { r } from '$lib/route';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: {
        featured: ['layout'],
        defaults: { layout: 'bubble' },
        enabled: true,
        order: 1
      },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 5 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'patterns', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'ChatMessageList Component', showToc: true }
  };
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Streaming append"
      description="Appending to the messages array (or growing the last message's text part as chunks arrive) is all it takes — the list follows as long as the reader is at the bottom. onStickChange tells you when following breaks so you can reflect it in your own UI, e.g. a 'following / paused' badge."
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
      description="Prepending older messages when the reader hits the top would normally yank the viewport. The list detects the prepend and anchors the scroll position, so the message you were reading stays put while history grows above it."
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
      description="The message snippet overrides how each entry renders — it receives message, index and isLast, and draws whatever you like. Reach for it to inject date separators, custom system notices, or a bespoke bubble; drop back to the default ChatMessage for the rest."
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

<Section marker="02" id="scroll-engine" title="Scroll engine">
  <p class="text-text-secondary text-sm leading-relaxed">
    The list owns one scrolling element and a deterministic engine on top of it — it does
    <em>not</em> rely on CSS <code class="text-text-primary">overflow-anchor</code> (Safari has none),
    so it corrects the scroll offset itself in every case.
  </p>
  <ul class="text-text-secondary mt-3 list-inside list-disc space-y-1.5 text-sm">
    <li>
      <strong>Follow while at the bottom.</strong> New content keeps the viewport pinned to the latest
      message — ideal for a streaming answer.
    </li>
    <li>
      <strong>Upward scroll breaks the follow.</strong> The moment you scroll away from the bottom the
      list stops chasing new content and surfaces a floating jump-back pill counting what arrived since.
    </li>
    <li>
      <strong>Proximity re-stick.</strong> Scroll back near the bottom (or click the pill) and
      following resumes. <code class="text-text-primary">onStickChange</code> fires on every flip.
    </li>
    <li>
      <strong>Prepend anchoring.</strong> When older messages are added to the front, the engine holds
      the reader's current message in place instead of jumping.
    </li>
  </ul>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Note: rest attributes (including a raw <code class="text-text-primary">onscroll</code>) land on
    the non-scrolling root — observe follow-state through
    <code class="text-text-primary">onStickChange</code>, not a scroll listener.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">
          Why the log is <code class="text-text-primary">aria-live="off"</code>
        </h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The messages render inside a <code class="text-text-primary">role="log"</code> region, but
          its live channel is deliberately <strong>off</strong>. A streaming answer changes the DOM
          dozens of times a second; a polite/assertive log would fire an announcement on every token
          and drown the user in fragments. So the log itself stays silent.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">The separate status region</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          Announcements come instead from a visually hidden
          <code class="text-text-primary">role="status"</code> region that speaks only the
          meaningful transitions: <code class="text-text-primary">generatingLabel</code> once when
          an assistant message starts streaming, and the settled answer once when it completes (or
          <code class="text-text-primary">errorLabel</code> /
          <code class="text-text-primary">abortedLabel</code> for a failed stream). Screen-reader users
          hear "generating…" then the final answer — never the token-by-token churn.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">
          Scrollable region is focusable
        </h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The viewport is a labelled <code class="text-text-primary">role="region"</code>
          (<code class="text-text-primary">listLabel</code>) with
          <code class="text-text-primary">tabindex="0"</code>, so keyboard users can focus the
          conversation and scroll it with the arrow /
          <kbd
            class="bg-surface-base border-border-subtle rounded-modify border px-1.5 py-0.5 text-xs font-medium"
            >Page</kbd
          >
          keys. Its focus ring uses <code class="text-text-primary">focus-visible:</code> (keyboard-only).
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">The jump-back button</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The floating pill is a real <code class="text-text-primary">&lt;button&gt;</code> whose
          <code class="text-text-primary">aria-label</code> carries the pending count (<code
            class="text-text-primary">newMessagesLabel</code
          >) or falls back to
          <code class="text-text-primary">scrollToBottomLabel</code> when nothing is pending — so its
          purpose is announced, not implied by an icon.
        </p>
      </div>
    </div>
  </div>
</Section>
