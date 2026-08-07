<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { r } from '$lib/route';
  import AgenticMessage from './examples/AgenticMessage.svelte';
  import CustomToolRenderer from './examples/CustomToolRenderer.svelte';
  import ErrorState from './examples/ErrorState.svelte';

  import agenticMessageCode from './examples/AgenticMessage.svelte?raw';
  import customToolRendererCode from './examples/CustomToolRenderer.svelte?raw';
  import errorStateCode from './examples/ErrorState.svelte?raw';
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="An agentic message"
      description="Reasoning, a tool call, answer text, and two sources — rendered in part order. The reasoning collapses into a 'Thought for 2s' disclosure, the tool call shows its settled state, and the sources dedupe into the citation footer while their [1] / [2] markers become inline chips."
      code={agenticMessageCode}
    >
      <AgenticMessage />
    </CodeExample>

    <CodeExample
      title="Custom tool-call renderer"
      description="partRenderers replaces the built-in rendering for a single part type — keyed by the part's type — without touching the rest of the dispatch. Here a compact status pill stands in for the default ToolCallCard; the snippet receives the fully-typed tool-call part."
      code={customToolRendererCode}
    >
      <CustomToolRenderer />
    </CodeExample>

    <CodeExample
      title="Error state with retry"
      description="A message with status='error' keeps whatever text streamed in and appends an Alert. Passing onRetry renders the Retry button; the same handler drives aborted messages too."
      code={errorStateCode}
    >
      <ErrorState />
    </CodeExample>
  </div>
</Section>

<!-- ─── Part dispatch ─── -->

<Section marker id="part-dispatch" title="Part dispatch">
  <p class="text-text-secondary text-sm leading-relaxed">
    A message is an ordered list of <code class="text-text-primary">parts</code>. ChatMessage walks
    them in order and picks a renderer per <code class="text-text-primary">type</code> — this is what
    lets a single component present a plain answer and a full agentic transcript alike.
  </p>
  <ul class="text-text-secondary mt-3 list-outside list-disc space-y-1.5 pl-5 text-sm">
    <li>
      <code class="text-text-primary">text</code> → rendered through
      <a href={r('/blocks/components/streaming-markdown')} class="text-primary hover:underline"
        >StreamingMarkdown</a
      >
      (never <code class="text-text-primary">{'{@html}'}</code>; every link is URL-policy checked).
    </li>
    <li>
      <code class="text-text-primary">reasoning</code> → a collapsed
      <a href={r('/blocks/components/reasoning-disclosure')} class="text-primary hover:underline"
        >ReasoningDisclosure</a
      > with a "Thought for Xs" label.
    </li>
    <li>
      <code class="text-text-primary">tool-call</code> → a
      <a href={r('/blocks/components/tool-call-card')} class="text-primary hover:underline"
        >ToolCallCard</a
      > reflecting its pending / running / complete / error state.
    </li>
    <li>
      <code class="text-text-primary">attachment</code> → a policy-checked chip; the URL is only ever
      a download link, never inline media.
    </li>
    <li>
      <code class="text-text-primary">source</code> → collected out of the flow into the
      deduplicated citation footer (and feeds the <code class="text-text-primary">[n]</code> markers).
    </li>
  </ul>
  <p class="text-text-secondary mt-3 text-sm leading-relaxed">
    Override any part type except <code class="text-text-primary">source</code> via
    <code class="text-text-primary">partRenderers</code>, and swap the avatar, action bar or
    metadata row through their respective snippets. The component never mutates the message it is
    handed.
  </p>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Labelled actions">
      <p>
        The copy and regenerate buttons carry <code class="text-text-primary">aria-label</code>s (<code
          class="text-text-primary">copyLabel</code
        >,
        <code class="text-text-primary">regenerateLabel</code>) and are wrapped in tooltips. They
        live in a bar revealed on <code class="text-text-primary">hover</code> /
        <code class="text-text-primary">focus-within</code>, so keyboard users reach them by tabbing
        — the reveal is presentational, not a focus trap.
      </p>
    </Note>
    <Note title="Copy feedback">
      <p>
        A successful copy is announced through a visually hidden
        <code class="text-text-primary">role="status"</code> region (the
        <code class="text-text-primary">copiedLabel</code> text), so screen-reader users hear the confirmation
        without a visible toast.
      </p>
    </Note>
    <Note title="Error &amp; aborted alerts">
      <p>
        <code class="text-text-primary">status: 'error'</code> and
        <code class="text-text-primary">'aborted'</code> render through the
        <a href={r('/blocks/primitives/alert')} class="text-primary hover:underline">Alert</a>
        primitive, so the failure is exposed with the correct alert semantics rather than styled text
        alone.
      </p>
    </Note>
    <Note title="Decorative avatar &amp; time">
      <p>
        The role avatar is decorative and hidden from assistive tech; the timestamp renders as a
        semantic <code class="text-text-primary">&lt;time datetime&gt;</code> element so the machine-readable
        instant travels with the visible label.
      </p>
    </Note>
  </NoteList>
</Section>
