<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, type Employee } from '../_data';

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

  // One row per entry HeaderMenu renders, with the predicate behind it from
  // utils/column-capabilities.ts. The toolbar's tools ask the same predicates,
  // so this table describes both surfaces.
  const menuActions = [
    { action: 'Sort ascending / descending', gate: 'a data column, unless sortable: false' },
    { action: 'Remove filters', gate: 'a filter on this column is active' },
    {
      action: 'Group by column / Remove grouping',
      gate: 'groupable: true, or sortable: true when groupable is unset — never while virtualized'
    },
    {
      action: 'Add summary / Remove summary',
      gate: "summable: true, or dataType: 'number' when summable is unset"
    },
    { action: 'Hide column', gate: 'enableColumnVisibility and hideable ≠ false' },
    { action: 'Show "Column"', gate: 'one entry per currently hidden column' }
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
  showToc={true}
>
  <Section id="sorting-grouping" title="Sorting & Grouping">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Every data column sorts on a header click, cycling ascending, descending, unsorted.
        <code class="text-text-primary">sortable: false</code> takes that away; a synthetic column has
        no value to sort by and never had it.
      </p>

      <p class="text-text-secondary text-sm">
        Grouping is the other way round: you opt a column in. Bucketing an email or a free-text note
        makes one group per row, so it is not offered to every column that holds a value.
        <code class="text-text-primary">groupable: true</code> says yes,
        <code class="text-text-primary">groupable: false</code> says no, and with neither set the
        column follows <code class="text-text-primary">sortable: true</code> — marking a column sortable
        already says it is a dimension worth organising the table by.
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
        <strong class="text-text-primary">Summaries are a preference, not a view setting.</strong>
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

      <p class="text-text-secondary text-sm">
        A summary is <code class="text-text-primary">{'{ column, type }'}</code> plus an optional
        <code class="text-text-primary">formatter</code>; the full shape is
        <a
          class="text-primary hover:underline"
          href={resolve('/table/table') + '#type-SummaryConfig'}>SummaryConfig</a
        >.
        <code class="text-text-primary">type</code> is
        <code class="text-text-primary">sum</code>, <code class="text-text-primary">avg</code>,
        <code class="text-text-primary">min</code>, <code class="text-text-primary">max</code> or
        <code class="text-text-primary">count</code>, and
        <code class="text-text-primary">count</code> is the one that does not do arithmetic: it counts
        the rows that have a value at all. The four others skip rows whose value is not a number, and
        show a dash when none is.
      </p>

      <p class="text-text-secondary text-sm">
        A summary covers every row matching the current search and filters, not the page on screen.
        The pager moves under a total that stays put.
      </p>

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
        and keyboard focus) that bundles the per-column actions, with no SmartFilterBar required. Each
        entry asks the same question the toolbar's tool of that name asks, so a column is never groupable
        from one and not from the other:
      </p>

      <div class="border-border-hairline overflow-x-auto border-y">
        <table class="w-full text-left text-sm">
          <thead class="text-text-primary border-border-hairline border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Entry</th>
              <th class="py-2 font-semibold">Shown when</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-hairline divide-y">
            {#each menuActions as item (item.action)}
              <tr>
                <td class="py-2 pr-4">{item.action}</td>
                <td class="py-2">{item.gate}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <CodeExample
        title="Try It"
        description="Hover a column header and open the ⋮ menu: sort, group by department, summarize salary, or hide a column."
        code={`const columns: Column<Employee>[] = [
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
];`}
        language="typescript"
      >
        <Table
          items={employees}
          columns={summaryColumns}
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
