<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Textarea } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';

  let bio = $state('');
  let feedback = $state('');
</script>

<!-- ─── Examples ─── -->

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Auto-resizing notes field"
      description="Pair `autoResize` with `minRows`/`maxRows` to grow the field as the user writes and cap the height before it dominates the layout."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        label="Notes"
        placeholder="Start typing — the field will grow..."
        autoResize
        minRows={2}
        maxRows={10}
      />
    </CodeExample>

    <CodeExample
      title="Character-limited composer"
      description="Combine `maxlength`, `showCounter`, and `autoResize` for tweet/comment-style inputs. The counter announces remaining characters via `aria-live`."
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
      title="Helper & error"
      description="Helper text and error text follow the same form-field contract as Input — `error` overrides `helper` when both are set and toggles `aria-invalid`."
      isolate
      previewClass="flex flex-col gap-4 max-w-md"
    >
      <Textarea
        label="Bio"
        helper="Write a short bio for your profile page"
        placeholder="I'm a..."
      />
      <Textarea
        label="Required field"
        error="This field is required"
        placeholder="Cannot be empty"
      />
    </CodeExample>

    <CodeExample
      title="Feedback Form"
      description="Textarea in a realistic form context with bound value and character counter."
      isolate
      previewClass="flex justify-center max-w-md w-full mx-auto"
    >
      <div class="border-border-subtle bg-surface-elevated w-full space-y-4 rounded-2xl border p-5">
        <Textarea
          label="Your Feedback"
          placeholder="What could we improve?"
          maxlength={500}
          showCounter
          autoResize
          minRows={3}
          maxRows={8}
          bind:value={feedback}
        />
        <p class="text-text-tertiary text-xs">
          {feedback.length > 0 ? `${feedback.length} characters entered` : 'No feedback yet'}
        </p>
      </div>
    </CodeExample>
  </div>
</Section>

<!-- ─── Customization ─── -->

<Section marker="02" id="customization" title="Customization">
  <div class="space-y-8">
    <CodeExample
      title="Code Input"
      description="Use slotClasses to create a code-friendly textarea with monospace font."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        label="JSON Config"
        placeholder={'{"key": "value"}'}
        slotClasses={{ base: 'font-mono text-sm' }}
        minRows={5}
      />
    </CodeExample>

    <CodeExample
      title="Fully Custom (unstyled)"
      description="Strip all defaults and build from scratch. All behavioral features still work."
      isolate
      previewClass="flex flex-col gap-3 max-w-md"
    >
      <Textarea
        unstyled
        autoResize
        maxlength={200}
        showCounter
        placeholder="Minimal textarea..."
        bind:value={bio}
        slotClasses={{
          wrapper: 'flex flex-col gap-1',
          base: 'bg-transparent border-b-2 border-text-tertiary px-0 py-2 text-text-primary placeholder:text-text-quaternary focus:outline-none focus:border-primary resize-none transition-colors',
          footer: 'flex justify-end',
          counter: 'text-xs text-text-tertiary tabular-nums'
        }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm leading-relaxed">
      A field treatment shared with Input and Select belongs in a <code class="text-text-primary"
        >BlocksProvider</code
      >
      preset (<code class="text-text-primary">presets.Textarea</code>) so the whole form speaks one
      language — see
      <a href={resolve('/customization')} class="text-primary hover:underline">Customization</a>.
    </p>
  </div>
</Section>

<!-- ─── Accessibility ─── -->

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Labels & Descriptions">
      <p>
        The <code class="text-text-primary">label</code> prop creates an associated
        <code class="text-text-primary">&lt;label&gt;</code> element linked via
        <code class="text-text-primary">for</code>/<code class="text-text-primary">id</code>. Helper
        and error text are linked via
        <code class="text-text-primary">aria-describedby</code>, and errors set
        <code class="text-text-primary">aria-invalid</code>.
      </p>
    </Note>
    <Note title="Character Counter">
      <p>
        The character counter uses
        <code class="text-text-primary">aria-live="polite"</code> to announce remaining characters to
        screen readers. Color changes at warning/over thresholds are paired with text for non-color-dependent
        feedback.
      </p>
    </Note>
    <Note title="Keyboard">
      <p>
        Standard textarea keyboard behavior. Focus rings use
        <code class="text-text-primary">focus-visible:</code> for keyboard-only visibility. Auto-resize
        does not interfere with keyboard interaction or scroll position.
      </p>
    </Note>
    <Note title="Reduced Motion">
      <p>
        Mint effects respect <code class="text-text-primary">prefers-reduced-motion</code>. The
        auto-resize height adjustment is instantaneous and does not animate.
      </p>
    </Note>
  </NoteList>
</Section>
