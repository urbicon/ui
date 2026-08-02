<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { asset } from '$app/paths';
  import { SourceFooter, CitationStyles, FromStreamingMarkdown } from './examples';

  import sourceFooterCode from './examples/SourceFooter.svelte?raw';
  import citationStylesCode from './examples/CitationStyles.svelte?raw';
  import fromStreamingMarkdownCode from './examples/FromStreamingMarkdown.svelte?raw';
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Standalone source footer"
      description="Use CitationChip on its own for a reference list under an answer or card — no streamed message required. Each chip opens a popover with the source title, snippet, and a policy-checked link."
      code={sourceFooterCode}
    >
      <SourceFooter />
    </CodeExample>

    <CodeExample
      title="Numeric vs. label"
      description="citationStyle picks what the chip shows. Reach for numeric — a compact footnote pill — when citations are dense and inline; reach for label — the truncated title — for a handful of named sources in a footer or sidebar."
      code={citationStylesCode}
    >
      <CitationStyles />
    </CodeExample>

    <CodeExample
      title="Wired up by StreamingMarkdown"
      description="Inside a streamed answer you rarely construct chips by hand: StreamingMarkdown resolves each [id] marker to a CitationChip from its sources prop, 1-based in array order. See the StreamingMarkdown page for the full streaming flow."
      code={fromStreamingMarkdownCode}
    >
      <FromStreamingMarkdown />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Descriptive trigger label">
      <p>
        A bare "[1]" tells a screen reader nothing, so the trigger's
        <code class="text-text-primary">aria-label</code> defaults to
        <code class="text-text-primary">Source {'{index}'}: {'{title}'}</code> (or
        <code class="text-text-primary">Source: {'{title}'}</code> with no index). Override it with
        the <code class="text-text-primary">label</code> prop when you need different wording.
      </p>
    </Note>
    <Note title="Named popover">
      <p>
        The chip opens a <code class="text-text-primary">Popover</code>; the same
        <code class="text-text-primary">aria-label</code> lands on the panel, so the opened dialog
        is named rather than anonymous. Keyboard and focus behaviour (open, close on
        <code class="text-text-primary">Escape</code>, focus return) come from the underlying
        Popover primitive.
      </p>
    </Note>
    <Note title="Policy-checked link">
      <p>
        The outbound link runs the same strict
        <code class="text-text-primary">urlPolicy</code> as the streaming-markdown engine. A blocked or
        absent URL yields no link at all — only the title and snippet — so untrusted source URLs can never
        smuggle a dangerous scheme into the popover.
      </p>
    </Note>
  </NoteList>
</Section>

<Section marker="03" id="related" title="Related">
  <div class="prose prose-sm max-w-none">
    <p>
      For the streaming flow that produces these chips automatically, see
      <a href={asset('/blocks/components/streaming-markdown')}>StreamingMarkdown</a> — its
      <code>sources</code> prop drives marker resolution and forwards the same
      <code>urlPolicy</code> to every chip.
    </p>
  </div>
</Section>
