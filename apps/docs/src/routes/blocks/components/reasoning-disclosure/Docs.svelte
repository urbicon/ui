<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import Settled from './examples/Settled.svelte';
  import StreamingSim from './examples/StreamingSim.svelte';
  import Localized from './examples/Localized.svelte';

  import settledCode from './examples/Settled.svelte?raw';
  import streamingSimCode from './examples/StreamingSim.svelte?raw';
  import localizedCode from './examples/Localized.svelte?raw';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Settled trace with a duration"
      description="Pass the elapsed time as durationMs and the header reads 'Thought for Xs'. It stays collapsed until the reader expands it. Inside, the trace renders through StreamingMarkdown."
      code={settledCode}
    >
      <Settled />
    </CodeExample>

    <CodeExample
      title="Streaming: the label pulses 'Thinking'"
      description="While streaming is set, the header shows 'Thinking' and the trace grows as text arrives. When the stream ends, set streaming to false and pass a durationMs, and the label settles to 'Thought for Xs'."
      code={streamingSimCode}
    >
      <StreamingSim />
    </CodeExample>

    <CodeExample
      title="Localized header"
      description="Every string in the header is a prop: formatDuration formats the seconds, thinkingLabel and reasoningLabel cover the streaming and no-duration cases. Override all three to localize; here in German."
      code={localizedCode}
    >
      <Localized />
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Disclosure semantics">
      <p>
        The header is a real <code class="text-text-primary">&lt;button&gt;</code> carrying
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> for the trace region, the standard
        Collapsible contract.
        <Kbd keys="Tab" />
        to reach it,
        <Kbd keys="Enter" />
        or
        <Kbd keys="Space" />
        to toggle. Focus rings use <code class="text-text-primary">focus-visible:</code>.
      </p>
    </Note>
    <Note title="Reduced motion">
      <p>
        The "Thinking" pulse is guarded by
        <code class="text-text-primary">motion-reduce:animate-none</code>, so readers who set
        <code class="text-text-primary">prefers-reduced-motion</code> get the same label without the animation.
      </p>
    </Note>
    <Note title="Untrusted output">
      <p>
        The trace is model output, so it renders through StreamingMarkdown, not
        <code class="text-text-primary">{'{@html}'}</code>, and its links follow the same strict
        <code class="text-text-primary">urlPolicy</code>.
      </p>
    </Note>
  </NoteList>
</Section>
