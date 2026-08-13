<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { BasicUsage, TrackCopy, HeaderActions } from './examples';

  import basicUsageCode from './examples/BasicUsage.svelte?raw';
  import trackCopyCode from './examples/TrackCopy.svelte?raw';
  import headerActionsCode from './examples/HeaderActions.svelte?raw';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Multi-line code"
      description="Pass the code as a string. It renders as raw text with no built-in highlighting, and long lines scroll horizontally inside the block rather than the page."
      code={basicUsageCode}
    >
      <BasicUsage />
    </CodeExample>

    <CodeExample
      title="Track copies with onCopy"
      description="onCopy fires only after the clipboard write succeeds, so it is a safe place to record an event like 'install command copied'."
      code={trackCopyCode}
    >
      <TrackCopy />
    </CodeExample>

    <CodeExample
      title="Extra header actions"
      description="The actions snippet renders custom controls in the header, just before the copy button: a 'Run' button, 'Open in editor', or a language switch."
      code={headerActionsCode}
    >
      <HeaderActions />
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Copy button label">
      <p>
        The copy button carries an <code class="text-text-primary">aria-label</code> that swaps from
        <code class="text-text-primary">copyLabel</code>
        ("Copy") to
        <code class="text-text-primary">copiedLabel</code> ("Copied") for two seconds after a successful
        copy, so its accessible name always matches what the user sees. A denied or failed clipboard write
        leaves the label unchanged, so a copy is confirmed only when it actually happened.
      </p>
    </Note>
    <Note title="Status announcement">
      <p>
        A visually hidden <code class="text-text-primary">role="status"</code> region announces "Copied"
        to screen readers. It ships in the DOM up front and only its text content changes, which assistive
        tech announces reliably.
      </p>
    </Note>
    <Note title="Scrollable region">
      <p>
        The code body is a focusable
        <code class="text-text-primary">role="region"</code> (<code class="text-text-primary"
          >tabindex="0"</code
        >) labelled by the language, so keyboard users can reach and scroll horizontally overflowing
        code (WCAG 2.1.1). Focus rings use
        <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
      </p>
    </Note>
  </NoteList>
</Section>
