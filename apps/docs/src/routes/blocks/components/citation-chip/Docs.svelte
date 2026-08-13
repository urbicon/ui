<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { asset } from '$app/paths';
  import { SourceFooter, CitationStyles, FromStreamingMarkdown } from './examples';

  import sourceFooterCode from './examples/SourceFooter.svelte?raw';
  import citationStylesCode from './examples/CitationStyles.svelte?raw';
  import fromStreamingMarkdownCode from './examples/FromStreamingMarkdown.svelte?raw';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Standalone source footer"
      description="Use CitationChip on its own for a reference list under an answer or card. Each chip opens a popover with the source title, snippet, and a policy-checked link."
      code={sourceFooterCode}
    >
      <SourceFooter />
    </CodeExample>

    <CodeExample
      title="Numeric vs. label"
      description="citationStyle sets what the chip shows. Use numeric, a compact footnote pill, when citations are dense and inline; use label, the truncated title, for a handful of named sources in a footer or sidebar."
      code={citationStylesCode}
    >
      <CitationStyles />
    </CodeExample>

    <CodeExample
      title="From StreamingMarkdown"
      description="Inside a streamed answer you rarely construct chips by hand: StreamingMarkdown resolves each [id] marker to a CitationChip from its sources prop, 1-based in array order. See the StreamingMarkdown page for the full streaming flow."
      code={fromStreamingMarkdownCode}
    >
      <FromStreamingMarkdown />
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
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
        <code class="text-text-primary">aria-label</code> lands on the panel, so the opened panel
        carries a name. Keyboard and focus behaviour (open, close on
        <code class="text-text-primary">Escape</code>, focus return) come from the underlying
        Popover primitive.
      </p>
    </Note>
    <Note title="Policy-checked link">
      <p>
        The outbound link follows the same strict
        <code class="text-text-primary">urlPolicy</code> as StreamingMarkdown. If the URL is blocked or
        absent, the popover shows just the title and snippet with no link, so an untrusted source URL
        cannot introduce a dangerous scheme.
      </p>
    </Note>
  </NoteList>
</Section>

<Section marker id="related" title="Related">
  <div class="text-text-secondary space-y-3 text-sm leading-relaxed">
    <p>
      For the streaming flow that produces these chips automatically, see
      <a href={asset('/blocks/components/streaming-markdown')}>StreamingMarkdown</a>. Its
      <code>sources</code> prop resolves the markers and applies the same
      <code>urlPolicy</code> to every chip.
    </p>
  </div>
</Section>
