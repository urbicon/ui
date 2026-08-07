<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Kbd } from '@urbicon-ui/blocks';
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Keycaps"
      description="Pass a string to keys for one keycap. Symbols like ⌘, ⇧ and ⌥ render as-is, and spelled-out names work the same way — useful for keys with no glyph."
      code={`<Kbd keys="⌘K" />
<Kbd keys="Esc" />
<Kbd keys="Enter" />
<Kbd keys="Tab" />`}
      language="svelte"
    >
      <div class="flex flex-wrap items-center gap-3">
        <Kbd keys="⌘K" />
        <Kbd keys="Esc" />
        <Kbd keys="Enter" />
        <Kbd keys="Tab" />
      </div>
    </CodeExample>

    <CodeExample
      title="Multi-key combos"
      description="An array joins each entry with the separator (default +). Use it for chorded shortcuts."
      code={`<Kbd keys={['Ctrl', 'K']} />
<Kbd keys={['⌘', '⇧', 'P']} />`}
      language="svelte"
    >
      <div class="flex flex-wrap items-center gap-4">
        <Kbd keys={['Ctrl', 'K']} />
        <Kbd keys={['⌘', '⇧', 'P']} />
      </div>
    </CodeExample>

    <CodeExample
      title="Inline in a sentence"
      description="Kbd sits on the text baseline, so it reads naturally inside running copy or a tooltip."
      code={`<p>Press <Kbd keys="/" size="sm" /> to search, or <Kbd keys={['⌘', 'K']} size="sm" /> for the command palette.</p>`}
      language="svelte"
    >
      <p class="text-text-secondary text-sm">
        Press <Kbd keys="/" size="sm" /> to search, or <Kbd keys={['⌘', 'K']} size="sm" /> for the command
        palette.
      </p>
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Semantic element">
      <p>
        Renders a semantic <code class="text-text-primary">&lt;kbd&gt;</code> element, the native
        HTML tag for keyboard input. It is presentational, so no explicit
        <code class="text-text-primary">role</code> is added.
      </p>
    </Note>
    <Note title="Announced as shown">
      <p>Every key is visible text, so screen readers read the shortcut exactly as it is shown.</p>
    </Note>
    <Note title="Decorative separator">
      <p>
        The <code class="text-text-primary">separator</code> drawn between keys carries
        <code class="text-text-primary">aria-hidden="true"</code> — assistive tech reads the keys,
        not the connective <code class="text-text-primary">+</code>.
      </p>
    </Note>
    <Note title="A hint, not a control">
      <p>
        <code class="text-text-primary">Kbd</code> never receives focus and has no interactive behaviour
        of its own. Wire the actual shortcut on the element it describes.
      </p>
    </Note>
  </NoteList>
</Section>
