<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, richColumns, type Employee } from '../_data';

  const navigation = [
    { id: 'sorting-grouping', title: 'Sorting & Grouping' },
    { id: 'summaries', title: 'Summaries' },
    { id: 'header-menu', title: 'Header Menu' }
  ];

  const summaryColumns: Column<Employee>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    {
      accessor: 'salary',
      title: 'Salary',
      sortable: true,
      summable: true,
      dataType: 'number',
      align: 'right'
    }
  ];

  const aggregationTypes = [
    { type: 'sum', label: '∑', desc: 'Total of all values in the column' },
    { type: 'avg', label: '⌀', desc: 'Arithmetic mean' },
    { type: 'count', label: '#', desc: 'Number of rows with a value' },
    { type: 'min', label: '↓', desc: 'Smallest value' },
    { type: 'max', label: '↑', desc: 'Largest value' }
  ];

  const menuActions = [
    { action: 'Sort ascending / descending', gate: 'sortable: true' },
    { action: 'Group by column / Remove grouping', gate: 'groupable: true' },
    { action: 'Add summary / Remove summary', gate: "summable: true, or dataType: 'number'" },
    { action: 'Hide column', gate: 'hideable ≠ false and enableColumnVisibility' },
    { action: 'Show "Column"', gate: 'listed for every currently hidden column' }
  ];
</script>

<!-- urbicon-ignore heading-skip — false positive. Rendered, the outline
     reads h2 (section), then h3 (CodeExample title), then h4, with no skip; the
     rule only knows `Section` as a heading-rendering component and cannot
     see the h3 a CodeExample title emits between the two. Verified against
     the served HTML, 2026-08. Tracked as issue #99. -->

<SeoMeta
  title="Sorting, Grouping & Summaries - Table"
  description="Sort by clicking column headers, group rows by any groupable column, and aggregate numeric columns with summary rows."
/>

<DocsPageLayout
  title="Sorting, Grouping & Summaries"
  description="Sort by clicking column headers, group rows by any groupable column, and aggregate numeric columns with summary rows."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="sorting-grouping" title="Sorting & Grouping">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Columns with <code class="text-text-primary">sortable: true</code> support click-to-sort
        (ascending / descending / none). Columns with
        <code class="text-text-primary">groupable: true</code> can be grouped via the SmartFilterBar,
        the column's header menu, or programmatically.
      </p>

      <CodeExample
        title="Start Sorted"
        description="viewDefaults.sort is the view's baseline — the header indicator shows it, and users can still change or clear it. A storage binding applies a stored sort after hydration and so beats the default; a stored sort: null is a real value, so a sort the user cleared stays cleared."
        code={`<Table
  {items}
  {columns}
  viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
/>`}
      >
        <Table
          items={employees}
          columns={summaryColumns}
          viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <CodeExample
        title="Grouping with Custom Order"
        description="Group rows by any column. The groupOrder array controls the display sequence of groups."
        code={`<Table
  {items}
  {columns}
  viewDefaults={{ groupBy: 'department' }}
  groupOrder={['Platform', 'Product', 'Design', 'Data']}
/>`}
      >
        <Table
          items={employees}
          columns={basicColumns}
          viewDefaults={{ groupBy: 'department' }}
          groupOrder={['Platform', 'Product', 'Design', 'Data']}
          enableSmartFilter={false}
        />
      </CodeExample>
    </div>
  </Section>

  <Section id="summaries" title="Summaries">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Summary rows aggregate a column across rows. When the table is grouped, each group gets its
        own summary row; without grouping, a single total row is appended below the data. Pass
        <code class="text-text-primary"
          >prefs=&#123;&#123; defaults: &#123; summaries: [&hellip;] &#125; &#125;&#125;</code
        >
        to enable summaries declaratively — users can also add and remove them at runtime via the
        <a href="#header-menu" class="text-primary hover:underline">header menu</a> or the SmartFilterBar's
        summary control.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">Summaries are a preference, not a view axis.</strong>
        Sorting and grouping decide
        <em>which</em> rows a reader sees, which makes them worth sharing and worth putting in a
        link — they live on the view. A summary row changes how the same rows are presented, so it
        belongs to this reader on this device and stays in web storage:
        <code class="text-text-primary">viewDefaults</code> for the former,
        <code class="text-text-primary">prefs</code> for the latter.
      </p>

      <CodeExample
        title="Per-Group Summaries"
        description="Group by department and sum the salary column. Each group renders its own summary row."
        code={`<Table
  {items}
  {columns}
  viewDefaults={{ groupBy: 'department', pageSize: 12 }}
  prefs={{ defaults: { summaries: [{ column: 'salary', type: 'sum' }] } }}
/>`}
      >
        <Table
          items={employees}
          columns={summaryColumns}
          viewDefaults={{ groupBy: 'department', pageSize: 12 }}
          prefs={{ defaults: { summaries: [{ column: 'salary', type: 'sum' }] } }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">SummaryConfig Reference</h4>
        <div class="mb-5 grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each [{ prop: 'column', desc: 'Column id to aggregate (the accessor name for string accessors)' }, { prop: 'type', desc: '"sum" | "avg" | "count" | "min" | "max"' }, { prop: 'formatter', desc: 'Optional (value: number) => string for the rendered aggregate, e.g. currency formatting' }] as item (item.prop)}
            <div>
              <code class="text-primary text-xs">{item.prop}</code>
              <p class="text-text-tertiary text-xs">{item.desc}</p>
            </div>
          {/each}
        </div>
        <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-5">
          {#each aggregationTypes as agg (agg.type)}
            <div>
              <code class="text-primary text-xs"
                >{agg.type} <span aria-hidden="true">{agg.label}</span></code
              >
              <p class="text-text-tertiary text-xs">{agg.desc}</p>
            </div>
          {/each}
        </div>
      </div>

      <p class="text-text-secondary text-sm">
        Which columns offer summaries is controlled per column:
        <code class="text-text-primary">summable: true</code> opts a column in,
        <code class="text-text-primary">summable: false</code> opts it out. When the flag is unset,
        columns with <code class="text-text-primary">dataType: 'number'</code> are summable
        automatically. Give the table a
        <a href={resolve('/table/customization')} class="text-primary hover:underline">
          preference store</a
        >
        (<code class="text-text-primary">prefs=&#123;&#123; storage: 'employees' &#125;&#125;</code
        >) and summary selections survive reloads, alongside column visibility and column order.
      </p>
    </div>
  </Section>

  <Section id="header-menu" title="Header Menu">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Every column header exposes a <code class="text-text-primary">⋮</code> menu (visible on hover
        and keyboard focus) that bundles the per-column actions — no SmartFilterBar required. Entries
        appear only when the column's flags allow the action:
      </p>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h3 class="text-text-primary mb-4 text-sm font-semibold">Menu Actions</h3>
        <div class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each menuActions as item (item.action)}
            <div>
              <span class="text-text-primary text-xs font-medium">{item.action}</span>
              <p class="text-text-tertiary text-xs"><code>{item.gate}</code></p>
            </div>
          {/each}
        </div>
      </div>

      <CodeExample
        title="Try It"
        description="Hover a column header and open the ⋮ menu — sort, group by department, summarize salary, or hide a column."
        code={`const columns: Column<Employee>[] = [
  { accessor: 'name', title: 'Name', sortable: true },
  { accessor: 'department', title: 'Department', sortable: true, groupable: true },
  { accessor: 'salary', title: 'Salary', sortable: true, summable: true, dataType: 'number' }
];`}
        language="typescript"
      >
        <Table
          items={employees}
          columns={richColumns}
          viewDefaults={{ pageSize: 5 }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <p class="text-text-secondary text-sm">
        Hiding and restoring columns is covered in
        <a href={resolve('/table/column-config')} class="text-primary hover:underline">
          Column Configuration → Column Visibility</a
        >.
      </p>
    </div>
  </Section>
</DocsPageLayout>
