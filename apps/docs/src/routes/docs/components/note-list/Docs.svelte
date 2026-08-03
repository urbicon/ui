<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
</script>

<Section marker="01" id="examples" title="Examples" subtitle="Notes as they appear on a page">
  <div class="flex flex-col gap-6">
    <CodeExample
      title="An accessibility card"
      description="The shape this component exists for: three short notes about ARIA, keyboard and motion, in the card that closes almost every component page."
      language="svelte"
      code={`<Section marker="04" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Built-in ARIA">
      <p>The trigger carries <code>aria-expanded</code> and points at the panel it opens.</p>
    </Note>
    <Note title="Keyboard">
      <p>Arrow keys move between items, Escape closes and returns focus to the trigger.</p>
    </Note>
    <Note title="Reduced motion">
      <p>The slide is dropped under <code>prefers-reduced-motion</code>; the panel still opens.</p>
    </Note>
  </NoteList>
</Section>`}
    >
      <NoteList>
        <Note title="Built-in ARIA">
          <p>The trigger carries <code>aria-expanded</code> and points at the panel it opens.</p>
        </Note>
        <Note title="Keyboard">
          <p>Arrow keys move between items, Escape closes and returns focus to the trigger.</p>
        </Note>
        <Note title="Reduced motion">
          <p>
            The slide is dropped under <code>prefers-reduced-motion</code>; the panel still opens.
          </p>
        </Note>
      </NoteList>
    </CodeExample>

    <CodeExample
      title="A note that is a list"
      description="The prose tokens sit on the row, not on an inner paragraph — so a note can hold a list without fighting the component for the block element."
      language="svelte"
      code={`<NoteList>
  <Note title="Supported keys">
    <ul class="list-disc pl-4">
      <li><code>Home</code> / <code>End</code> jump to the first and last row</li>
      <li><code>PageUp</code> / <code>PageDown</code> move by a visible page</li>
    </ul>
  </Note>
</NoteList>`}
    >
      <NoteList>
        <Note title="Supported keys">
          <ul class="list-disc pl-4">
            <li><code>Home</code> / <code>End</code> jump to the first and last row</li>
            <li><code>PageUp</code> / <code>PageDown</code> move by a visible page</li>
          </ul>
        </Note>
      </NoteList>
    </CodeExample>

    <CodeExample
      title="Flush, inside a surface that already has a border"
      description="`variant=&quot;flush&quot;` drops the card chrome and keeps the rules between rows — for a note list nested in a card, an InfoCard or a table cell."
      language="svelte"
      code={`<Card variant="outlined" class="p-6">
  <h3 class="mb-2 font-semibold">Before you deploy</h3>
  <NoteList variant="flush">
    <Note title="Environment">Set <code>ORIGIN</code>, or the CSRF check rejects every POST.</Note>
    <Note title="Migrations">Run them before the new build takes traffic, not after.</Note>
  </NoteList>
</Card>`}
    >
      <div class="border-border-subtle bg-surface-elevated w-full rounded-2xl border p-6">
        <h3 class="text-text-primary mb-2 text-base font-semibold">Before you deploy</h3>
        <NoteList variant="flush">
          <Note title="Environment">
            Set <code>ORIGIN</code>, or the CSRF check rejects every POST.
          </Note>
          <Note title="Migrations">Run them before the new build takes traffic, not after.</Note>
        </NoteList>
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="No landmark, no heading of its own">
      <p>
        The list renders a plain <code>&lt;div&gt;</code>. The enclosing
        <code>&lt;Section&gt;</code> is already a named region, and a second nested one would add a landmark
        that announces nothing new — a screen-reader user would step into it and hear an unnamed region.
      </p>
    </Note>
    <Note title="Note titles are real headings">
      <p>
        A note title renders an <code>&lt;h3&gt;</code> by default, so the notes appear in the
        document outline under their section heading. Set <code>headingLevel</code> when the list
        sits deeper than a top-level <code>&lt;Section&gt;</code> — a title styled to look like a
        heading but emitted as a <code>&lt;div&gt;</code> is invisible to the outline.
      </p>
    </Note>
    <Note title="Separators are decoration">
      <p>
        The rules between rows are borders, not <code>&lt;hr&gt;</code> elements, so they carry no semantics
        and are not announced. The grouping a reader hears comes from the headings.
      </p>
    </Note>
  </NoteList>
</Section>
