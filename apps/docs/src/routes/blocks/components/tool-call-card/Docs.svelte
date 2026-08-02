<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import Lifecycle from './examples/Lifecycle.svelte';
  import ErrorState from './examples/ErrorState.svelte';
  import CustomBody from './examples/CustomBody.svelte';

  import lifecycleCode from './examples/Lifecycle.svelte?raw';
  import errorStateCode from './examples/ErrorState.svelte?raw';
  import customBodyCode from './examples/CustomBody.svelte?raw';
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Lifecycle: running to complete"
      description="The consumer owns the tool-call part and mutates its state and output as the real call resolves. While busy the header shows a spinner and a neutral status; on completion it flips to a success badge and reveals the output. The card stays collapsed the whole time — a successful call is not worth a click."
      code={lifecycleCode}
    >
      <Lifecycle />
    </CodeExample>

    <CodeExample
      title="Failure opens itself"
      description="A call in the error state starts expanded so the failure is visible without a click, and shows errorMessage above the input. A manual toggle afterwards always wins — auto-open never fights the reader."
      code={errorStateCode}
    >
      <ErrorState />
    </CodeExample>

    <CodeExample
      title="Domain-specific body via the children snippet"
      description="Pass a children snippet to replace the default JSON input/output with a view built for the tool. The snippet receives the same part; the status header (badge + monospaced tool name) and the collapse mechanics stay. Here a web_search result set renders as a ranked list instead of raw JSON."
      code={customBodyCode}
    >
      <CustomBody />
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        Status is text, not just color
      {/snippet}
      <p>
        The spinner and the status <code class="text-text-primary">Badge</code> are decorative (<code
          class="text-text-primary">aria-hidden</code
        >). The header carries a single
        <code class="text-text-primary">sr-only</code> line with the current state label (<code
          class="text-text-primary">Pending</code
        >
        / <code class="text-text-primary">Running</code>
        / <code class="text-text-primary">Done</code> /
        <code class="text-text-primary">Failed</code>), so assistive tech reads the status once and
        never announces a spinner as content.
      </p>
    </Note>
    <Note title="Disclosure semantics">
      <p>
        The header is a real <code class="text-text-primary">&lt;button&gt;</code> with
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> pointing at the body region — the same
        Collapsible contract as the rest of the library.
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
    </Note>
    <Note title="Untrusted output">
      <p>
        Input and output render as plain text inside <code class="text-text-primary">CodeBlock</code
        >, never as interpreted HTML — tool results are untrusted data.
      </p>
    </Note>
  </NoteList>
</Section>
