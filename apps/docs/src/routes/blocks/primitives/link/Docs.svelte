<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Link } from '@urbicon-ui/blocks';

  // The tab strip below is a preview, so its current section is local state
  // rather than `page.url.pathname` — the docs route never changes underneath it.
  const tabs = [
    { label: 'Overview', href: '#link-overview' },
    { label: 'Settings', href: '#link-settings' },
    { label: 'Logs', href: '#link-logs' }
  ];
  let current = $state('#link-settings');
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="A link in prose"
      description="The default voice. An underline — not a colour — is what marks a link inside running text, so the paragraph keeps one ink and stays readable for anyone who cannot tell the hues apart."
      code={`<p>
  Read the <Link href="/blocks/primitives/breadcrumb">Breadcrumb page</Link> before
  wiring a trail, or jump straight to the
  <Link href="/design-system/tokens">token reference</Link>.
</p>`}
      language="svelte"
    >
      <p class="text-text-secondary max-w-prose text-sm">
        Read the <Link href="/blocks/primitives/breadcrumb">Breadcrumb page</Link> before wiring a trail,
        or jump straight to the <Link href="/design-system/tokens">token reference</Link>.
      </p>
    </CodeExample>

    <CodeExample
      title="Route tabs"
      description="A nav of standalone handles: no underline, tertiary at rest, document ink under the pointer, and the current one already there at medium weight — so hovering shows what arriving will look like. `active` writes the `aria-current` the strip needs; the URL holds the rest, so there is no component state to keep in step."
      code={`<nav aria-label="Project sections" class="flex gap-4">
  {#each tabs as tab (tab.href)}
    <Link
      variant="standalone"
      href={tab.href}
      active={page.url.pathname === tab.href}
    >
      {tab.label}
    </Link>
  {/each}
</nav>`}
      language="svelte"
    >
      <nav aria-label="Example project sections" class="flex flex-wrap gap-4 py-1 text-sm">
        {#each tabs as tab (tab.href)}
          <Link
            variant="standalone"
            href={tab.href}
            active={current === tab.href}
            onclick={(event) => {
              event.preventDefault();
              current = tab.href;
            }}
          >
            {tab.label}
          </Link>
        {/each}
      </nav>
    </CodeExample>

    <CodeExample
      title="A link you cannot follow yet"
      description="`disabled` keeps the address on the element and takes the link out of the tab order: it is dimmed, answers no click and announces itself as `aria-disabled`. Reach for it where the target exists but is not reachable for this user or this state — not as a way to hide a page."
      code={`<Link href="/reports/2026" disabled>Annual report (available in January)</Link>`}
      language="svelte"
    >
      <p class="text-sm">
        <Link href="/reports/2026" disabled>Annual report (available in January)</Link>
      </p>
    </CodeExample>
  </div>
</Section>

<Section marker id="accessibility" title="Accessibility">
  <NoteList>
    <Note title="Always an anchor">
      <p>
        <code class="text-text-primary">Link</code> renders an
        <code class="text-text-primary">&lt;a href&gt;</code> and never swaps its root element, so
        browser history, middle-click, copy-link, prefetch and the no-JavaScript fallback all come
        for free. A link that should <em>look</em> like a button stays a thin wrapper over
        <code class="text-text-primary">buttonVariants()</code> in your own app.
      </p>
    </Note>
    <Note title="The current page announces itself">
      <p>
        <code class="text-text-primary">active</code> renders
        <code class="text-text-primary">aria-current="page"</code>, which is how assistive
        technology reads back which handle in a strip is the one you are on. It is the shorthand for
        the page case and wins where both are given — for
        <code class="text-text-primary">"step"</code> in a wizard trail, or
        <code class="text-text-primary">"true"</code> for a non-page target, pass
        <code class="text-text-primary">aria-current</code> yourself and leave
        <code class="text-text-primary">active</code> unset.
      </p>
    </Note>
    <Note title="A disabled link keeps its address">
      <p>
        <code class="text-text-primary">disabled</code> writes
        <code class="text-text-primary">aria-disabled="true"</code> and
        <code class="text-text-primary">tabindex="-1"</code>: the link leaves the tab order and
        answers no pointer, but the
        <code class="text-text-primary">href</code> stays on the element, so it is still readable and
        copyable. Keyboard users skip past it rather than landing on a control that answers nothing.
      </p>
    </Note>
    <Note title="The focus ring follows the line">
      <p>
        Focus is drawn with <code class="text-text-primary">outline</code>, which follows an inline
        link across a line break — a link that wraps mid-sentence is ringed per line fragment, not
        boxed over the paragraph. It appears on
        <code class="text-text-primary">:focus-visible</code> only, and takes its colour and width
        from the <code class="text-text-primary">--blocks-focus-ring-*</code> tokens — including the wider
        high-contrast step. In a horizontally scrolling strip, leave the container a little vertical padding
        so the ring is not clipped at its padding box.
      </p>
    </Note>
  </NoteList>
</Section>
