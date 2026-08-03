<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
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
      For large datasets (&gt;1,000 rows), enable
      <code class="text-text-primary">virtualized</code> to render only visible rows. The table uses a
      lightweight custom virtualizer (zero dependencies) that keeps ~20 rows in the DOM regardless of
      dataset size.
    </p>

    <CodeExample
      headingLevel={2}
      title="10,000 Rows"
      description="Only ~20 rows are in the DOM. Pagination is bypassed – all items are in a scrollable container."
      code={`<Table
items={largeDataset}
columns={columns}
virtualized={true}
virtualHeight="400px"
/>`}
      preview={false}
    />

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">Notes</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          Pagination is automatically disabled when
          <code class="text-text-primary">virtualized</code> is true
        </li>
        <li>
          Virtualization wins over grouping – grouped virtualization is not implemented, so the
          grouping affordances (header menu, toolbar menu) are suppressed and an
          <code class="text-text-primary">initialGroupBy</code>, a controlled
          <code class="text-text-primary">groupByKey</code> or a persisted grouping is ignored with
          a dev warning. Group server-side, or drop
          <code class="text-text-primary">virtualized</code>
        </li>
        <li>
          Row heights are fixed per <code class="text-text-primary">size</code> (sm/md/lg) — rows with
          dynamic height (wrapping text, expanded content) are not supported in virtualized mode
        </li>
        <li>Selection and keyboard navigation work normally with virtualized rows</li>
        <li>
          <code class="text-text-primary">virtualHeight</code> accepts any CSS value:
          <code class="text-text-primary">'400px'</code>,
          <code class="text-text-primary">'60vh'</code>,
          <code class="text-text-primary">'calc(100vh - 200px)'</code>
        </li>
      </ul>
    </div>
  </div>
</DocsPageLayout>
