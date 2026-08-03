<script lang="ts">
  import { Kbd } from '@urbicon-ui/blocks';
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';
</script>

<SeoMeta title="Column Reorder - Table" />

<DocsPageLayout
  title="Column Reorder"
  description="Drag-and-drop column reordering with keyboard support."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="column-reorder">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableColumnReorder</code> to let users drag column
        headers into a new order. Also supports keyboard reorder via
        <Kbd keys="Shift" />+<Kbd keys="Arrow Left/Right" />.
      </p>

      <CodeExample
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
  </Section>
</DocsPageLayout>
