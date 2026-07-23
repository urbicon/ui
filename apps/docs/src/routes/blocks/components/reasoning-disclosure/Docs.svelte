<script lang="ts">
  import type { SvelteDocsConfig } from '@urbicon-ui/shared-types';
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import Settled from './examples/Settled.svelte';
  import StreamingSim from './examples/StreamingSim.svelte';
  import Localized from './examples/Localized.svelte';

  import settledCode from './examples/Settled.svelte?raw';
  import streamingSimCode from './examples/StreamingSim.svelte?raw';
  import localizedCode from './examples/Localized.svelte?raw';

  export const docsConfig: SvelteDocsConfig = {
    generation: {
      overview: { enabled: false },
      playground: { enabled: true, order: 1 },
      variants: { enabled: false },
      examples: false,
      api: { showInheritance: true, enabled: true, order: 14 },
      usage: false
    },
    llm: {
      include: true,
      maxSections: 8,
      priority: ['overview', 'examples', 'real-world', 'patterns', 'api'],
      excludeTypes: ['playground']
    },
    meta: { title: 'ReasoningDisclosure Component', showToc: true }
  };
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Settled trace with a duration"
      description="Once the model finishes thinking, pass the elapsed time as durationMs and the header reads 'Thought for Xs'. It stays collapsed — the reader expands it only if they care how the answer was reached. Inside, the trace renders through StreamingMarkdown in a damped tertiary tone."
      code={settledCode}
    >
      <Settled />
    </CodeExample>

    <CodeExample
      title="Streaming: the label pulses 'Thinking'"
      description="While the caller sets streaming, the header shows 'Thinking' with a gentle pulse (disabled under prefers-reduced-motion) and the trace grows live. When the stream ends, swap streaming off and hand it a durationMs — the label settles to 'Thought for Xs' without a layout jump."
      code={streamingSimCode}
    >
      <StreamingSim />
    </CodeExample>

    <CodeExample
      title="Localized header"
      description="The whole header is text-driven: formatDuration receives whole seconds, thinkingLabel and reasoningLabel cover the streaming and no-duration cases. Override all three to localize — here in German."
      code={localizedCode}
    >
      <Localized />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
    <div class="divide-border-subtle divide-y">
      <div class="pb-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Disclosure semantics</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The header is a real <code class="text-text-primary">&lt;button&gt;</code> carrying
          <code class="text-text-primary">aria-expanded</code> and
          <code class="text-text-primary">aria-controls</code> for the trace region — the standard
          Collapsible contract.
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Tab</kbd
          >
          to reach it,
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Enter</kbd
          >
          or
          <kbd
            class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
            >Space</kbd
          >
          to toggle. Focus rings use <code class="text-text-primary">focus-visible:</code>.
        </p>
      </div>
      <div class="py-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Reduced motion</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The "Thinking" pulse is guarded by
          <code class="text-text-primary">motion-reduce:animate-none</code> — readers who set
          <code class="text-text-primary">prefers-reduced-motion</code> get the same label without the
          animation. The label change itself is enough of a status cue.
        </p>
      </div>
      <div class="pt-4">
        <h4 class="text-text-primary mb-1.5 text-sm font-semibold">Untrusted output</h4>
        <p class="text-text-secondary text-sm leading-relaxed">
          The trace is model output, so it renders through StreamingMarkdown — never
          <code class="text-text-primary">{'{@html}'}</code> — and any links inherit the same strict
          <code class="text-text-primary">urlPolicy</code> as the rest of the chat surface.
        </p>
      </div>
    </div>
  </div>
</Section>
