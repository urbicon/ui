<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';
</script>

<SeoMeta
  title="Column Reorder - Table"
  description="Drag-and-drop column reordering with keyboard support."
/>

<DocsPageLayout
  title="Column Reorder"
  description="Drag-and-drop column reordering with keyboard support."
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
      Set <code class="text-text-primary">enableColumnReorder</code> and users can drag column
      headers into a new order. From the keyboard, focus a header and press
      <Kbd keys="Shift" />+<Kbd keys="Arrow Left/Right" /> to move that column one step.
    </p>

    <CodeExample
      headingLevel={2}
      title="Reorderable Columns"
      description="Drag a header, or focus one and press Shift + Arrow Left/Right. This demo has no storage key, so a reload puts the columns back in source order."
      code={`<Table
  {items}
  {columns}
  enableColumnReorder
/>`}
    >
      <Table
        cardsBelow="32rem"
        items={employees.slice(0, 5)}
        columns={basicColumns}
        enableColumnReorder
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 5 }}
      />
    </CodeExample>

    <p class="text-text-secondary text-sm">
      The order lives in the table, keyed by each column's
      <code class="text-text-primary">id</code> (its
      <code class="text-text-primary">accessor</code>, when the column has no explicit one). Passing
      a fresh <code class="text-text-primary">columns</code> array therefore leaves it alone, and a
      column you add later lands at the end. To keep the order across reloads, give the table a
      <a href={resolve('/table/customization')} class="text-primary hover:underline"
        >preferences storage key</a
      >; <code class="text-text-primary">prefs.defaults.columnOrder</code> sets the order to start from,
      such as one you loaded with the user's profile.
    </p>
  </div>
</DocsPageLayout>
