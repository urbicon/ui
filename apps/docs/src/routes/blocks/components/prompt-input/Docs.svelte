<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import ChatComposer from './examples/ChatComposer.svelte';
  import WithAttachments from './examples/WithAttachments.svelte';
  import WithModelSelect from './examples/WithModelSelect.svelte';

  import chatComposerCode from './examples/ChatComposer.svelte?raw';
  import withAttachmentsCode from './examples/WithAttachments.svelte?raw';
  import withModelSelectCode from './examples/WithModelSelect.svelte?raw';
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-10">
    <CodeExample
      title="Chat composer with stop"
      description="The core AI pattern: bind the draft, drive busy from your streaming state. While busy the send button becomes a stop button and Enter no longer submits — onStop aborts the in-flight response. Type a message and watch the send/stop swap."
      code={chatComposerCode}
    >
      <ChatComposer />
    </CodeExample>

    <CodeExample
      title="Attachments with validation"
      description="Opt in with allowAttachments, then constrain with accept, maxFiles, and maxFileSize — the same file-intake core as FileUpload. Rejected files never enter the list; onAttachmentReject surfaces why. Add images via the paperclip, drag-and-drop, or paste a screenshot; try a non-image or a fourth file to see a rejection."
      code={withAttachmentsCode}
    >
      <WithAttachments />
    </CodeExample>

    <CodeExample
      title="Model picker in the trailing zone"
      description="The trailing snippet renders in the composer's right action zone, before the send button — the natural home for a model selector, tool toggle, or temperature control. leading (after the attach button) and hint (a line below) are the companion slots."
      code={withModelSelectCode}
    >
      <WithModelSelect />
    </CodeExample>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="02" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>
        The textarea carries an <code class="text-text-primary">aria-label</code> (the
        <code class="text-text-primary">label</code>
        prop, default "Message") and
        <code class="text-text-primary">aria-keyshortcuts</code>
        that reflects the active submit gesture — <code class="text-text-primary">Enter</code> for
        <code class="text-text-primary">submitOn="enter"</code>, or
        <code class="text-text-primary">Meta+Enter Control+Enter</code>
        for <code class="text-text-primary">mod-enter</code> — so assistive tech announces the real
        keystroke. The send, stop, and attach buttons each have their own
        <code class="text-text-primary">aria-label</code>
        (<code class="text-text-primary">sendLabel</code> /
        <code class="text-text-primary">stopLabel</code> /
        <code class="text-text-primary">attachLabel</code>). Attachment thumbnails are decorative
        and hidden from screen readers.
      </p>
    </Note>
    <Note title="Error status region">
      <p>
        The inline error (first attachment rejection) lives in a
        <code class="text-text-primary">role="status"</code>
        region that the textarea references via
        <code class="text-text-primary">aria-describedby</code>. It stays
        <code class="text-text-primary">sr-only</code>
        while empty, so the message is announced when it appears and the region never leaves a visual
        gap. It clears on the next successful add.
      </p>
    </Note>
    <Note title="Chip removal & focus">
      <p>
        Each attachment chip's remove button is labelled via
        <code class="text-text-primary">removeAttachmentLabel(name)</code>. Removing a chip moves
        focus deterministically — to the chip that shifted into its place, else the last remaining
        chip, else back to the textarea when the strip empties — so keyboard users are never dropped
        to <code class="text-text-primary">&lt;body&gt;</code>. Removing a chip through the UI also
        revokes its preview object-URL for you.
      </p>
    </Note>
    <Note title="Keyboard & IME">
      <p>
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Enter</kbd
        >
        sends (or inserts a newline under
        <code class="text-text-primary">submitOn="mod-enter"</code>);
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Shift</kbd
        >
        +
        <kbd
          class="bg-surface-base border-border-subtle rounded border px-1.5 py-0.5 text-xs font-medium"
          >Enter</kbd
        >
        always inserts a newline. Submission is suppressed mid-IME-composition, so composing Japanese,
        Chinese, or Korean text never fires a stray send. Focus rings use
        <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility.
      </p>
    </Note>
  </NoteList>
</Section>
