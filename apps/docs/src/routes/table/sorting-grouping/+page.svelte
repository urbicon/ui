<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';
</script>

<SeoMeta title="Sorting & Grouping - Table" />

<DocsPageLayout
  title="Sorting & Grouping"
  description="Sort by clicking column headers. Group rows by any groupable column with custom display order."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="sorting-grouping">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Columns with <code class="text-text-primary">sortable: true</code> support click-to-sort
        (ascending / descending / none). Columns with
        <code class="text-text-primary">groupable: true</code> can be grouped via the SmartFilterBar or
        programmatically.
      </p>

      <CodeExample
        title="Grouping with Custom Order"
        description="Group rows by any column. The groupOrder array controls the display sequence of groups."
        code={`<Table
  {items}
  {columns}
  initialGroupBy="department"
  groupOrder={['Platform', 'Product', 'Design', 'Data']}
/>`}
      >
        <Table
          items={employees}
          columns={basicColumns}
          initialGroupBy="department"
          groupOrder={['Platform', 'Product', 'Design', 'Data']}
          enableSmartFilter={false}
        />
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
