<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';
</script>

<SeoMeta title="Filtering & Search - Table" />

<DocsPageLayout
  title="Filtering & Search"
  description="Built-in search, column filters, and summary controls via the SmartFilterBar."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="filtering">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableSmartFilter</code> to get a full-featured toolbar
        with search, per-column filters, grouping controls, and summary aggregations.
      </p>

      <CodeExample
        title="Smart Filter Bar"
        description="Search across all searchable columns. Add per-column filters via the filter button. Debounce controls request frequency."
        code={`<Table
  {items}
  {columns}
  enableSmartFilter={true}
  searchPlaceholder="Search employees..."
  searchDebounceMs={300}
/>`}
      >
        <Table
          items={employees}
          columns={basicColumns}
          enableSmartFilter={true}
          searchPlaceholder="Search employees..."
          itemsPerPage={6}
        />
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
