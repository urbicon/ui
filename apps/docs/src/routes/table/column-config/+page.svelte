<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, richColumns } from '../_data';
</script>

<SeoMeta title="Column Configuration - Table" />

<DocsPageLayout
  title="Column Configuration"
  description="Rich column properties to control sorting, filtering, grouping, summaries, responsive priority, and custom cell rendering."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="column-config">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Each column object supports a rich set of properties to control sorting, filtering,
        grouping, summaries, responsive priority, and custom cell rendering.
      </p>

      <CodeExample
        title="Rich Column Properties"
        description="Width constraints, responsive priority levels, groupable/summable flags, and data type hints."
        code={`const columns: Column<Employee>[] = [
  {
    accessor: 'name',
    title: 'Name',
    sortable: true,
    searchable: true,
    width: '200px',        // fixed width
    minWidth: '120px',     // minimum on resize
    priority: 1            // primary — becomes the mobile card title
  },
  {
    accessor: 'department',
    title: 'Department',
    sortable: true,
    groupable: true,       // enable group-by in SmartFilterBar
    dataType: 'text'
  },
  {
    accessor: 'salary',
    title: 'Salary',
    sortable: true,
    summable: true,        // enable sum/avg/min/max in SmartFilterBar
    dataType: 'number',
    align: 'right'
  },
  {
    accessor: 'status',
    title: 'Status',
    sortable: false,       // disable sorting for this column
    searchable: false      // exclude from search
  },
  {
    accessor: 'notes',
    title: 'Notes',
    priority: 3            // desktop-only — omitted from the mobile card
  }
];`}
        language="typescript"
      >
        <Table
          items={employees}
          columns={richColumns}
          itemsPerPage={5}
          enableSmartFilter={true}
          searchPlaceholder="Try grouping, summaries..."
        />
      </CodeExample>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Column Properties Reference</h4>
        <div class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each [{ prop: 'accessor', desc: 'Property name on the row (primitive value) or function `(item) => value`' }, { prop: 'id', desc: 'Stable column identifier \u2013 required for function accessors and synthetic columns; defaults to accessor name for string accessors' }, { prop: 'title', desc: 'Column header label' }, { prop: 'sortable', desc: 'Enable click-to-sort (default: false)' }, { prop: 'searchable', desc: 'Include in SmartFilterBar search (default: true)' }, { prop: 'groupable', desc: 'Allow group-by via SmartFilterBar or header menu' }, { prop: 'summable', desc: 'Allow sum/avg/count via SmartFilterBar' }, { prop: 'dataType', desc: '"text" | "number" | "date" \u2013 drives filter operators' }, { prop: 'align', desc: '"left" | "center" | "right" \u2013 cell text alignment' }, { prop: 'width / minWidth', desc: 'Fixed or minimum column width (CSS string)' }, { prop: 'priority', desc: '1/unset = primary (mobile card title), 2 = secondary detail, 3 = desktop-only (hidden in card)' }, { prop: 'cell', desc: 'Snippet for custom cell rendering' }, { prop: 'flex', desc: 'Use flex layout inside header cell' }] as item (item.prop)}
            <div>
              <code class="text-primary text-xs">{item.prop}</code>
              <p class="text-text-tertiary text-xs">{item.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </Section>
</DocsPageLayout>
