<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Button, Textarea } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let bio = $state('');
  let feedback = $state('');
  let feedbackError = $state('');
  let sent = $state(false);

  function handleFeedback(event: SubmitEvent) {
    event.preventDefault();
    const text = String(new FormData(event.currentTarget as HTMLFormElement).get('feedback') ?? '');
    feedbackError = text.trim().length < 20 ? 'Tell us a little more, at least 20 characters' : '';
    sent = !feedbackError;
  }
</script>

<!-- ─── Examples ─── -->

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Auto-resizing notes field"
      description="`autoResize` measures the text after every keystroke and after a `value` you assign yourself. `maxRows` is where the growing stops and the field starts scrolling. `minRows` is a floor it never shrinks below, and the `size` brings a floor of its own that a small `minRows` disappears under."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        label="Notes"
        placeholder="Start typing and the field will grow..."
        autoResize
        minRows={2}
        maxRows={10}
      />
    </CodeExample>

    <CodeExample
      title="Character-limited composer"
      description="`showCounter` needs a `maxlength` to count against and then reads `count/limit`. It switches to the warning colour at 90 percent of the limit, which `counterWarningThreshold` moves, and typing stops at the limit itself."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        label="Tweet"
        placeholder="What's happening?"
        maxlength={280}
        showCounter
        autoResize
        minRows={2}
      />
    </CodeExample>

    <CodeExample
      title="In a form"
      description="A real `<textarea>` sits underneath, so `name` submits the text and `required`, `readonly` or an `oninput` handler all reach it. `error` is yours to set from whatever the submit finds out, and it takes the helper text's place while it is there."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <form
        class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5"
        onsubmit={handleFeedback}
      >
        <Textarea
          name="feedback"
          label="Your feedback"
          placeholder="What could we improve?"
          helper="Anything from a typo to a missing feature"
          error={feedbackError}
          maxlength={500}
          showCounter
          autoResize
          minRows={3}
          maxRows={8}
          bind:value={feedback}
        />
        <Button type="submit" size="sm">Send feedback</Button>
        {#if sent}
          <p class="text-success text-xs">Thanks, that went through.</p>
        {/if}
      </form>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker id="customization" title="Customization">
  <div class="space-y-6">
    <CodeExample
      title="A quieter field"
      description="The bare-line look is the `underline` variant, so it costs no classes at all. What is left for `slotClasses` is the counter row underneath, addressed by the `footer` and `counter` slots."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        variant="underline"
        label="Release note"
        autoResize
        minRows={4}
        maxlength={200}
        showCounter
        placeholder="What changed in this version?"
        bind:value={bio}
        slotClasses={{
          footer: 'justify-start',
          counter: 'tabular-nums tracking-wide'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A treatment the whole form shares belongs on a
      <code class="text-text-primary">BlocksProvider</code>, as a
      <code class="text-text-primary">defaults</code> entry for
      <code class="text-text-primary">Textarea</code> next to the same entry for
      <a href={resolve('/blocks/primitives/input')} class="text-primary hover:underline">Input</a>
      and
      <a href={resolve('/blocks/primitives/select')} class="text-primary hover:underline">Select</a
      >. See
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>
      for <code class="text-text-primary">class</code>,
      <code class="text-text-primary">slotClasses</code>,
      <code class="text-text-primary">unstyled</code>, <code class="text-text-primary">preset</code>
      and provider-level overrides.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Labels and messages">
      <p>
        The <code class="text-text-primary">label</code> prop renders a
        <code class="text-text-primary">&lt;label&gt;</code> linked through
        <code class="text-text-primary">for</code>/<code class="text-text-primary">id</code>, and
        the id is generated unless you pass one. Helper and error text reach the field through
        <code class="text-text-primary">aria-describedby</code>, and an
        <code class="text-text-primary">error</code> sets
        <code class="text-text-primary">aria-invalid</code>.
      </p>
    </Note>
    <Note title="Character counter">
      <p>
        The counter is <code class="text-text-primary">aria-live="polite"</code>, so a screen reader
        speaks the new count once the user pauses instead of cutting in on every keystroke.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>The focus ring shows for keyboard users only.</p>
    </Note>
  </NoteList>
</Section>
