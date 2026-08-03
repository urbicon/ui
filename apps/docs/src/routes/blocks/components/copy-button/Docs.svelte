<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Card, CopyButton } from '@urbicon-ui/blocks';

  const variants = ['ghost', 'outlined', 'filled'] as const;

  // onCopy callback demo — a plain $state counter is enough to show the hook firing.
  let copies = $state(0);
</script>

<Section marker="01" id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="Icon-only (default)"
      description="With no label the button is icon-only — drop it beside a value the user needs to grab. On success the icon swaps to a check and the intent flips to success for a moment."
      code={`<code>npm i @urbicon-ui/blocks</code>
<CopyButton value="npm i @urbicon-ui/blocks" />`}
      language="svelte"
    >
      <div class="flex items-center gap-2">
        <code class="bg-surface-elevated text-text-primary rounded px-2 py-1 text-sm">
          npm i @urbicon-ui/blocks
        </code>
        <CopyButton value="npm i @urbicon-ui/blocks" />
      </div>
    </CodeExample>

    <CodeExample
      title="With a label"
      description="Pass label for a labelled button. The visible text becomes the accessible name, and it swaps to copiedLabel (default “Copied”) on success."
      code={`<CopyButton value="npm i @urbicon-ui/blocks" label="Copy" variant="outlined" />`}
      language="svelte"
    >
      <CopyButton value="npm i @urbicon-ui/blocks" label="Copy" variant="outlined" />
    </CodeExample>

    <CodeExample
      title="Variants"
      description="CopyButton forwards variant to the underlying Button, so it speaks the full button styling vocabulary — ghost (default), outlined, filled and text."
      code={`{#each ['ghost', 'outlined', 'filled'] as variant}
  <CopyButton value="urbicon" label="Copy" {variant} />
{/each}`}
      language="svelte"
    >
      <div class="flex flex-wrap items-center gap-3">
        {#each variants as variant (variant)}
          <CopyButton value="urbicon" label="Copy" {variant} />
        {/each}
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="02" id="in-context" title="In context">
  <div class="space-y-8">
    <CodeExample
      title="Copy an install command"
      description="The most common home for CopyButton: paired with a command or key inside a Card, so the value and its copy affordance read as one unit."
      code={`<Card padding="lg">
  <div class="flex items-center justify-between gap-4">
    <code>npm i @urbicon-ui/blocks</code>
    <CopyButton value="npm i @urbicon-ui/blocks" />
  </div>
</Card>`}
      language="svelte"
    >
      <Card padding="lg">
        <div class="flex items-center justify-between gap-4">
          <code class="text-text-primary text-sm">npm i @urbicon-ui/blocks</code>
          <CopyButton value="npm i @urbicon-ui/blocks" />
        </div>
      </Card>
    </CodeExample>

    <CodeExample
      title="onCopy callback"
      description="onCopy fires with the copied value after a successful write — use it to log analytics, show a toast, or drive local state. onError fires on the failure path instead."
      code={`<` +
        `script>
  let copies = $state(0);
<` +
        `/script>

<CopyButton value="urbicon" label="Copy token" onCopy={() => copies++} />
<span>Copied {copies} time(s)</span>`}
      language="svelte"
    >
      <div class="flex items-center gap-3">
        <CopyButton value="urbicon" label="Copy token" onCopy={() => copies++} />
        <span class="text-text-secondary text-sm">Copied {copies} time(s)</span>
      </div>
    </CodeExample>
  </div>
</Section>

<Section marker="03" id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Stable name in icon-only mode">
      <p>
        In icon-only mode the button keeps a stable accessible name (<em>Copy</em>, or your own
        <code>aria-label</code>); the outcome is not baked into the name.
      </p>
    </Note>
    <Note title="Label in Name in labelled mode">
      <p>
        In labelled mode the visible text is the accessible name (WCAG 2.5.3, Label in Name); no
        <code>aria-label</code> overrides it.
      </p>
    </Note>
    <Note title="The result is announced">
      <p>
        A visually-hidden <code>role="status"</code> live region announces the result —
        <em>Copied</em>
        or <em>Copy failed</em> — the moment it happens, in both modes and without stealing focus.
        (An <code>aria-label</code> change alone is not reliably announced, so the icon-only default would
        otherwise be silent to a screen reader.)
      </p>
    </Note>
    <Note title="The icon is decorative">
      <p>
        The copy/check icon is <code>aria-hidden</code>; sighted users read state from the icon, the
        intent colour, and (in labelled mode) the swapped label.
      </p>
    </Note>
    <Note title="Failure has a path">
      <p>
        The clipboard write can fail in an insecure (non-HTTPS) context or when permission is
        denied. That path calls <code>onError</code> and shows the failed state rather than throwing through
        the render.
      </p>
    </Note>
  </NoteList>
</Section>
