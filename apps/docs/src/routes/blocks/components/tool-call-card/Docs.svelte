<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import Lifecycle from './examples/Lifecycle.svelte';
  import ErrorState from './examples/ErrorState.svelte';
  import FramedTrace from './examples/FramedTrace.svelte';
  import CustomBody from './examples/CustomBody.svelte';

  import lifecycleCode from './examples/Lifecycle.svelte?raw';
  import errorStateCode from './examples/ErrorState.svelte?raw';
  import framedTraceCode from './examples/FramedTrace.svelte?raw';
  import customBodyCode from './examples/CustomBody.svelte?raw';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Lifecycle: running to complete"
      description="The consumer owns the tool-call part and mutates its state and output as the real call resolves. While busy the header shows a spinner beside the tool name; on completion the status flips to Done and the output becomes available. It stays collapsed the whole time — a successful call is not worth a click, and the default quiet header keeps it out of the reader's way."
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
      title="Framed, where the call is the content"
      description="variant=&quot;card&quot; puts the header back in a frame: outline, radius, status badge, full width. That is the right register for a run log or an agent trace — a surface someone opened to read the calls themselves. In a chat stream it is the wrong one, which is why quiet is the default."
      code={framedTraceCode}
    >
      <FramedTrace />
    </CodeExample>

    <CodeExample
      title="Domain-specific body via the children snippet"
      description="Pass a children snippet to replace the default JSON input/output with a view built for the tool. The snippet receives the same part; the status header (status + monospaced tool name) and the collapse mechanics stay. Here a web_search result set renders as a ranked list instead of raw JSON."
      code={customBodyCode}
    >
      <CustomBody />
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note>
      {#snippet titleSnippet()}
        Status is text, not just color
      {/snippet}
      <p>
        The state label (<code class="text-text-primary">Pending</code>
        / <code class="text-text-primary">Running</code>
        / <code class="text-text-primary">Done</code> /
        <code class="text-text-primary">Failed</code>) is always in the header, and always exactly
        once: the quiet header prints it as visible text, the framed one shows it as a decorative
        <code class="text-text-primary">Badge</code>
        (<code class="text-text-primary">aria-hidden</code>) paired with a single
        <code class="text-text-primary">sr-only</code> line. The spinner is decorative in both, so assistive
        tech reads the status once and never announces a spinner as content.
      </p>
    </Note>
    <Note title="Disclosure semantics">
      <p>
        The header is a real <code class="text-text-primary">&lt;button&gt;</code> with
        <code class="text-text-primary">aria-expanded</code> and
        <code class="text-text-primary">aria-controls</code> pointing at the body region — the same
        Collapsible contract as the rest of the library.
        <Kbd keys="Tab" />
        to reach it,
        <Kbd keys="Enter" />
        or
        <Kbd keys="Space" />
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
