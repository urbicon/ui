<script lang="ts">
  import { CodeExample, Note, NoteList, Section } from '@urbicon-ui/docs';
  import { Link } from '@urbicon-ui/blocks';
  import { page } from '$app/state';
  import { resolve } from '$app/paths';

  // Real routes, so the strip below is the pattern rather than a picture of it:
  // the handles navigate, and the lit one is the page being read.
  const tabs = [
    { label: 'Breadcrumb', href: resolve('/blocks/primitives/breadcrumb') },
    { label: 'Link', href: resolve('/blocks/primitives/link') },
    { label: 'Pagination', href: resolve('/blocks/primitives/pagination') }
  ];

  // In the built site `resolve()` hands back a href relative to the current page
  // (the dev server renders it absolute), so the bare `page.url.pathname ===
  // href` of the tab-navigation pattern — whose hrefs are absolute — matches
  // nothing here. Resolving against the page first answers for either spelling,
  // which is why this page and the snippet beside the strip differ.
  const isCurrent = (href: string) => new URL(href, page.url).pathname === page.url.pathname;
</script>

<Section marker id="examples" title="Examples">
  <div class="space-y-8">
    <CodeExample
      title="A link in prose"
      description="The default voice: link ink from the `--color-text-link` token plus an underline. Two cues, because colour alone is not one for every reader — and the token is the single lever for restyling links project-wide. Hover moves the underline, not the text colour, so a paragraph of links does not flicker under the pointer."
      code={`<p>
  Read the <Link href="/blocks/primitives/breadcrumb">Breadcrumb page</Link> before
  wiring a trail, or jump straight to the
  <Link href="/customization/tokens">token reference</Link>.
</p>`}
      language="svelte"
    >
      <p class="text-text-secondary max-w-prose text-sm">
        Read the <Link href={resolve('/blocks/primitives/breadcrumb')}>Breadcrumb page</Link> before wiring
        a trail, or jump straight to the
        <Link href={resolve('/customization/tokens')}>token reference</Link>.
      </p>
    </CodeExample>

    <CodeExample
      title="Route tabs"
      description="A nav of standalone handles: no underline, tertiary at rest, document ink under the pointer, and the current one already there at medium weight — so hovering shows what arriving will look like. `active` writes the `aria-current` the strip needs; the URL holds the rest, so there is no component state to keep in step. The strip below is live: these are real pages, and the lit handle is the one you are reading. One difference between it and the snippet: this docs app routes its hrefs through `resolve()`, which the built site renders relative to the current page, so the preview resolves each href against `page.url` before comparing. An app with absolute hrefs uses the comparison as written here."
      code={`<script lang="ts">
  import { Link } from '@urbicon-ui/blocks';
  import { page } from '$app/state';

  const tabs = [
    { label: 'Breadcrumb', href: '/blocks/primitives/breadcrumb' },
    { label: 'Link', href: '/blocks/primitives/link' },
    { label: 'Pagination', href: '/blocks/primitives/pagination' }
  ];
<\/script>

<nav
  aria-label="Related component pages"
  class="flex flex-wrap gap-4 py-[calc(var(--blocks-focus-ring-width)+var(--blocks-focus-ring-offset))] text-sm"
>
  {#each tabs as tab (tab.href)}
    <Link variant="standalone" href={tab.href} active={page.url.pathname === tab.href}>
      {tab.label}
    </Link>
  {/each}
</nav>`}
      language="svelte"
    >
      <nav
        aria-label="Related component pages"
        class="flex flex-wrap gap-4 py-[calc(var(--blocks-focus-ring-width)+var(--blocks-focus-ring-offset))] text-sm"
      >
        {#each tabs as tab (tab.href)}
          <Link variant="standalone" href={tab.href} active={isCurrent(tab.href)}>
            {tab.label}
          </Link>
        {/each}
      </nav>
    </CodeExample>

    <CodeExample
      title="A link you cannot follow yet"
      description="`disabled` keeps the address on the element and takes the link out of the tab order: it is dimmed, cancels every activation — pointer, Enter, assistive technology — and announces itself as `aria-disabled`. Reach for it where the target exists but is not reachable in this state; the one below would open the Pagination page."
      code={`<Link href="/blocks/primitives/pagination" disabled>
  Pagination (unlocked once the list has more than one page)
</Link>`}
      language="svelte"
    >
      <p class="text-sm">
        <Link href={resolve('/blocks/primitives/pagination')} disabled>
          Pagination (unlocked once the list has more than one page)
        </Link>
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
    <Note title="A disabled link answers nothing, but keeps its address">
      <p>
        <code class="text-text-primary">disabled</code> writes
        <code class="text-text-primary">aria-disabled="true"</code> and
        <code class="text-text-primary">tabindex="-1"</code>, and cancels the navigation in a click
        handler — so a pointer, Enter on a focused link and an assistive-technology activation all
        do nothing, and your own <code class="text-text-primary">onclick</code> is not called
        either.
        <code class="text-text-primary">pointer-events-none</code> alone would only stop the mouse.
        The
        <code class="text-text-primary">href</code> stays on the element, so the address is still readable
        and copyable, and keyboard users skip past the link rather than landing on a control that answers
        nothing.
      </p>
    </Note>
    <Note title="Give the focus ring room in a scrolling strip">
      <p>
        Focus is drawn with <code class="text-text-primary">outline</code> on
        <code class="text-text-primary">:focus-visible</code> only, following the link's line
        fragments rather than boxing the whole paragraph, and taking its width, offset and colour
        from the <code class="text-text-primary">--blocks-focus-ring-*</code> tokens. A horizontally
        scrolling container clips at its padding box, so give it padding computed from those same
        tokens —
        <code class="text-text-primary"
          >py-[calc(var(--blocks-focus-ring-width)+var(--blocks-focus-ring-offset))]</code
        >
        — rather than a fixed value: under
        <code class="text-text-primary">prefers-contrast: more</code> the ring grows, and a hand-counted
        padding clips it exactly for the readers who need it most.
      </p>
    </Note>
  </NoteList>
</Section>
