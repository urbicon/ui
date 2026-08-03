<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
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
      Enable <code class="text-text-primary">enableColumnReorder</code> to let users drag column
      headers into a new order. Also supports keyboard reorder via
      <Kbd keys="Shift" />+<Kbd keys="Arrow Left/Right" />.
    </p>

    <CodeExample
      headingLevel={2}
      title="Drag-and-Drop Column Reorder"
      description="Drag headers to rearrange columns. Uses the shared createDraggable utility (zero dependencies)."
      code={`<Table
{items}
{columns}
enableColumnReorder={true}
/>`}
    >
      <Table
        items={employees.slice(0, 5)}
        columns={basicColumns}
        enableColumnReorder={true}
        enableSmartFilter={false}
        itemsPerPage={5}
      />
    </CodeExample>
  </div>
</DocsPageLayout>
