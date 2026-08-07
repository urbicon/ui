<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Note, NoteList } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
</script>

<SeoMeta
  title="Virtual Scrolling - Table"
  description="Render only visible rows for large datasets with a lightweight zero-dependency virtualizer."
/>

<DocsPageLayout
  title="Virtual Scrolling"
  description="Render only visible rows for large datasets with a lightweight zero-dependency virtualizer."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <!-- No <Section> wrapper: this page has one unnamed topic, so there is
       nothing to name, no table of contents to feed and no anchor pointing
       here. A Section that renders no heading is a `<div class="relative">`
       plus an unnamed landmark. The pages in this group with more than one
       topic (filtering, selection, sorting-grouping, column-config,
       live-updates, sticky-pinning) do carry titled sections and a nav.

       `headingLevel={2}` on the examples below is load-bearing, not a
       leftover: with no section heading on the page they are the only h2,
       and dropping them to the default h3 puts an h1 -> h3 skip on the
       page (measured, 2026-08). -->
  <div class="space-y-8">
    <p class="text-text-secondary text-sm">
      <code class="text-text-primary">virtualized</code> renders only the rows in view, plus five above
      and five below. A 400&nbsp;px viewport holds about seven rows at the default size, so the table
      keeps under twenty in the DOM whether the set has a thousand rows or a million. Reach for it once
      the browser is doing more drawing than the reader can see.
    </p>

    <CodeExample
      headingLevel={2}
      title="10,000 Rows"
      description="One scrollable container instead of pages."
      code={`<Table
  items={largeDataset}
  {columns}
  virtualized
  virtualHeight="400px"
/>`}
      preview={false}
    />

    <p class="text-text-secondary text-sm">
      Every row is in one scrollable container, so there are no pages to turn: the pager is gone
      while <code class="text-text-primary">virtualized</code> is set.
      <code class="text-text-primary">virtualHeight</code> takes any CSS length, so
      <code class="text-text-primary">'60vh'</code> and
      <code class="text-text-primary">'calc(100vh - 200px)'</code> work as well as a pixel value. Selection
      and keyboard navigation behave as they do anywhere else.
    </p>

    <NoteList variant="flush">
      <Note title="Grouping is switched off, not just hidden">
        Grouped virtualization is not implemented, and a grouping that slipped through would put
        every row back in the DOM. So the table drops it whichever way it arrives — view defaults,
        URL, storage — and hides the grouping affordances, with a warning in dev. The discard is the
        table's decision rather than the reader's: the URL is cleaned, storage is left alone, and a
        grouping the reader chose earlier applies again on a page without
        <code>virtualized</code>. Group on the server, or drop <code>virtualized</code>.
      </Note>
      <Note title="Row heights are fixed">
        The virtualizer computes positions from one height per
        <code>size</code> (48, 56 and 64&nbsp;px for sm, md and lg), so a row that grows — wrapping text,
        expanded content — lands in the wrong place. Those rows need the unvirtualized table.
      </Note>
    </NoteList>
  </div>
</DocsPageLayout>
