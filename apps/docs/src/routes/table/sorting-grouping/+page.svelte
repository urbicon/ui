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
    { action: 'Remove filter', gate: 'a filter on this column is active' },
    {
      action: 'Group by column / Remove grouping',
      gate: 'groupable: true, or sortable: true when groupable is unset (never while virtualized)'
    },
    {
      action: 'Add summary / Remove summary',
      gate: "summable: true, or dataType: 'number' when summable is unset"
    },
    { action: 'Hide column', gate: 'enableColumnVisibility and hideable ≠ false' },
    { action: 'Show "Salary"', gate: 'one entry per currently hidden column, named after it' }
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
        Every data column sorts on a header click, cycling ascending, descending, unsorted. One
        column at a time: a click on another header moves the sort there.
        <code class="text-text-primary">sortable: false</code> takes that away, and a synthetic
        column (one with no <code class="text-text-primary">accessor</code>) has no value to sort by
        and never had it.
      </p>

      <CodeExample
        title="Start Sorted"
        description="`viewDefaults.sort` is the view's baseline: the header indicator shows it, and users can still change or clear it."
        code={`<Table
  {items}
  {columns}
  viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
/>`}
      >
        <Table
          cardsBelow="32rem"
          items={employees}
          columns={summaryColumns}
          viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <p class="text-text-secondary text-sm">
        A sort is view state: a shared link or a view restored from storage carries it, and either
        one overrides this baseline.
        <a href={resolve('/table/url-state') + '#phases'} class="text-primary hover:underline"
          >URL State &amp; Persistence</a
        > sets out which of the three wins.
      </p>

      <p class="text-text-secondary text-sm">
        Grouping is opt-in: bucketing an email or a free-text note makes one group per row, so it is
        not offered to every column that holds a value.
        <code class="text-text-primary">groupable: true</code> says yes,
        <code class="text-text-primary">groupable: false</code> says no, and with neither set an
        explicit <code class="text-text-primary">sortable: true</code> grants it. A column that
        declares nothing at all sorts, but does not group. Both flags sit on the column, beside the
        rest of its
        <a href={resolve('/table/column-config')} class="text-primary hover:underline">properties</a
        >.
      </p>

      <p class="text-text-secondary text-sm">
        A <a href={resolve('/table/virtual-scrolling')} class="text-primary hover:underline"
          >virtualized</a
        >
        table never groups: the menu entry goes, and a grouping arriving from the view defaults, a URL
        or storage renders ungrouped — the value itself stays on the view.
      </p>

      <CodeExample
        title="Grouping with Custom Order"
        description="`groupOrder` names the groups that come first; every other group follows in the order its rows arrive, and a name with no rows is skipped. Rows with no value in that column land in a group called Unassigned."
        code={`<Table
  {items}
  {columns}
  viewDefaults={{ groupBy: 'department' }}
  groupOrder={['Platform', 'Product', 'Design', 'Data']}
/>`}
      >
        <Table
          cardsBelow="32rem"
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
        to enable summaries declaratively. Users can also add and remove them at runtime via the
        <a href="#header-menu" class="text-primary hover:underline">header menu</a>
        or the
        <a href={resolve('/table/filtering')} class="text-primary hover:underline">SmartFilterBar</a
        >'s summary control.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">Summaries are a preference, not a view setting.</strong>
        Sorting and grouping decide
        <em>which</em> rows a reader sees, so they live on the view and travel in a shared link. A
        summary row changes how the same rows are presented, so it belongs to this reader on this
        device and stays in web storage:
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
          cardsBelow="32rem"
          items={employees}
          columns={summaryColumns}
          viewDefaults={{ groupBy: 'department', pageSize: 12 }}
          prefs={{ defaults: { summaries: [{ column: 'salary', type: 'sum' }] } }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <p class="text-text-secondary text-sm">
        A summary is <code class="text-text-primary">{'{ column, type }'}</code> plus an optional
        <code class="text-text-primary">{'formatter: (value: number) => string'}</code>; the full
        shape is
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
        The pager moves under a total that stays put. A table that leaves the work to the server
        only holds the page it was handed, so there the total is that page's:
        <a
          href={resolve('/table/server-processing') + '#controls'}
          class="text-primary hover:underline">Server Processing</a
        > says what to do instead.
      </p>

      <p class="text-text-secondary text-sm">
        Which columns offer summaries is controlled per column:
        <code class="text-text-primary">summable: true</code> opts a column in,
        <code class="text-text-primary">summable: false</code> opts it out. When the flag is unset,
        columns with <code class="text-text-primary">dataType: 'number'</code> are summable
        automatically. <code class="text-text-primary">storage</code> sits beside
        <code class="text-text-primary">defaults</code> in the same object (<code
          class="text-text-primary"
          >prefs=&#123;&#123; storage: 'employees', defaults: &#123; summaries &#125; &#125;&#125;</code
        >), and then summary choices survive reloads alongside column visibility and column order.
        What the reader last chose wins over your defaults, an empty choice included:
        <a
          href={resolve('/table/customization') + '#persistence'}
          class="text-primary hover:underline">What the table remembers</a
        > has the rest of the channel.
      </p>
    </div>
  </Section>

  <Section id="header-menu" title="Header Menu">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Every column header exposes a <code class="text-text-primary">⋮</code> menu (visible on hover
        and keyboard focus) that bundles the per-column actions, with no SmartFilterBar required. The
        same column flags decide what each entry offers and what the toolbar's tool of that name offers:
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
          cardsBelow="32rem"
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
