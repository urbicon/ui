<script lang="ts">
  import { CodeExample, Section } from '@urbicon-ui/docs';
  import { Kbd } from '@urbicon-ui/blocks';

  const sizes = ['sm', 'md', 'lg'] as const;
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Single key"
      description="Pass a string to keys for one keycap. Symbols like ⌘, ⇧ and ⌥ render as-is."
      code={`<Kbd keys="⌘K" />`}
      language="svelte"
    >
      <Kbd keys="⌘K" />
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
      title="Sizes"
      description="Three keycap sizes — sm, md (default) and lg — to match the surrounding text scale."
      code={`{#each ['sm', 'md', 'lg'] as size}
  <Kbd keys="⌘K" {size} />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-wrap items-center gap-4">
        {#each sizes as size (size)}
          <div class="flex flex-col items-center gap-2">
            <Kbd keys="⌘K" {size} />
            <span class="text-text-tertiary text-xs">{size}</span>
          </div>
        {/each}
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

    <CodeExample
      title="Named keys"
      description="Spelled-out key names work exactly like symbols — useful for keys with no glyph."
      code={`<Kbd keys="Esc" />
<Kbd keys="Enter" />
<Kbd keys="Tab" />`}
      language="svelte"
    >
      <div class="flex flex-wrap items-center gap-3">
        <Kbd keys="Esc" />
        <Kbd keys="Enter" />
        <Kbd keys="Tab" />
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="accessibility" title="Accessibility">
  <div class="prose prose-sm max-w-none">
    <ul>
      <li>
        Renders a semantic <code>&lt;kbd&gt;</code> element, the native HTML tag for keyboard input.
        It is presentational, so no explicit <code>role</code> is added.
      </li>
      <li>
        Every key is visible text, so screen readers read the shortcut exactly as it is shown.
      </li>
      <li>
        The <code>separator</code> drawn between keys carries <code>aria-hidden="true"</code> —
        assistive tech reads the keys, not the connective <code>+</code>.
      </li>
      <li>
        <code>Kbd</code> is a hint, not a control — it never receives focus and has no interactive behaviour
        of its own. Wire the actual shortcut on the element it describes.
      </li>
    </ul>
  </div>
</Section>
