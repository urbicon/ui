<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, richColumns, type Employee } from '../_data';

  const navigation = [
    { id: 'column-config', title: 'Column Properties' },
    { id: 'column-visibility', title: 'Column Visibility' }
  ];

  // How the five capability flags relate — which is page material, not
  // per-prop material: three of them fall back to another flag, and a reader
  // deciding what to declare needs them side by side. The per-flag contract is
  // the JSDoc on `DerivableMixin` / `BaseColumn` in packages/table, which is
  // what an editor shows on hover. It does not reach the generated Types
  // section: docs-gen slices an interface's own members and does not follow
  // `extends`, so `Column` there resolves to `id` + `accessor` and nothing else.
  const capabilityFlags = [
    {
      name: 'sortable',
      unset: 'sorts',
      governs: 'the header click, the header menu, the toolbar’s sort tool'
    },
    {
      name: 'searchable',
      unset: 'matches',
      governs: 'the search field and the column’s own filter entry (one flag for both)'
    },
    {
      name: 'groupable',
      unset: 'off, unless the column declares sortable: true',
      governs: 'the header menu and the toolbar’s grouping tool'
    },
    {
      name: 'summable',
      unset: "off, unless the column declares dataType: 'number'",
      governs: 'whether Sum / Avg / Min / Max / Count are offered for the column'
    },
    {
      name: 'hideable',
      unset: 'can be hidden',
      governs: 'the visibility menu and the header menu’s hide action'
    }
  ];

  const visibilityColumns: Column<Employee>[] = [
    { accessor: 'name', title: 'Name', sortable: true, hideable: false },
    { accessor: 'role', title: 'Role', sortable: true },
    { accessor: 'department', title: 'Department', sortable: true },
    {
      accessor: 'salary',
      title: 'Salary',
      sortable: true,
      dataType: 'number',
      align: 'right'
    }
  ];
</script>

<!-- urbicon-ignore heading-skip — false positive. Rendered, the outline
     reads h2 (section), then h3 (CodeExample title), then h4, with no skip; the
     rule only knows `Section` as a heading-rendering component and cannot
     see the h3 a CodeExample title emits between the two. Verified against
     the served HTML, 2026-08. Tracked as issue #99. -->

<SeoMeta
  title="Column Configuration - Table"
  description="Column properties that control width and alignment, sorting, filtering, grouping, summaries, visibility, and what reaches the mobile card."
/>

<DocsPageLayout
  title="Column Configuration"
  description="Column properties that control width and alignment, sorting, filtering, grouping, summaries, visibility, and what reaches the mobile card."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
  showToc={true}
>
  <Section id="column-config" title="Column Properties">
    <div class="space-y-8">
      <CodeExample
        title="A Configured Column Set"
        description="Width constraints, responsive priority levels, groupable/summable flags, and data type hints."
        code={`import type { Column } from '@urbicon-ui/table';

const columns: Column<Employee>[] = [
  {
    accessor: 'name',
    title: 'Name',
    sortable: true,
    searchable: true,
    width: '200px',        // any CSS length
    minWidth: '120px',     // floor for that width; takes effect only alongside it
    priority: 1            // 1 or unset: primary, and reaches the mobile card
  },
  {
    accessor: 'role',
    title: 'Role',
    sortable: true,
    searchable: true,
    priority: 2            // secondary, and reaches the card too
  },
  {
    accessor: 'department',
    title: 'Department',
    sortable: true,
    groupable: true,       // offer the column in the grouping tool
    dataType: 'text'       // 'text' | 'number' | 'date' | 'boolean' | 'email' | 'url'
  },
  {
    accessor: 'salary',
    title: 'Salary',
    sortable: true,
    summable: true,        // offer Sum / Avg / Min / Max / Count
    dataType: 'number',
    align: 'right'         // 'left' (default) | 'center' | 'right'
  },
  {
    accessor: 'status',
    title: 'Status',
    sortable: true
  },
  {
    accessor: 'location',
    title: 'Location',
    sortable: true,
    priority: 3            // desktop-only: dropped from the mobile card
  }
];`}
        language="typescript"
      >
        <Table
          cardsBelow="32rem"
          items={employees}
          columns={richColumns}
          viewDefaults={{ pageSize: 5 }}
          enableSmartFilter={true}
          searchPlaceholder="Try grouping, summaries..."
        />
      </CodeExample>

      <p class="text-text-secondary text-sm">
        A column takes one of three shapes, discriminated by <code class="text-text-primary"
          >accessor</code
        >: a <strong class="text-text-primary">string accessor</strong> naming a primitive-valued
        row property (<code class="text-text-primary">id</code> defaults to the accessor name), a
        <strong class="text-text-primary">function accessor</strong> deriving the value from the row
        (explicit <code class="text-text-primary">id</code> required), or a
        <strong class="text-text-primary">synthetic column</strong> without any accessor, typically
        action buttons. Synthetic columns are structurally excluded from
        <code class="text-text-primary">sortable</code>/<code class="text-text-primary"
          >searchable</code
        >/<code class="text-text-primary">groupable</code>/<code class="text-text-primary"
          >summable</code
        >/<code class="text-text-primary">dataType</code>: there is no value to operate on, and the
        type rejects those flags at compile time.
      </p>

      <p class="text-text-secondary text-sm">
        An actions column is the usual synthetic one:
        <code class="text-text-primary"
          >{`{ id: 'actions', title: '', menuTitle: 'Actions', hideable: false, component: RowActions }`}</code
        >. The empty <code class="text-text-primary">title</code> keeps the header cell blank,
        <code class="text-text-primary">menuTitle</code> gives the column a readable name in the
        visibility and header menus, and
        <code class="text-text-primary">component</code> receives the row as
        <code class="text-text-primary">item</code>.
      </p>

      <p class="text-text-secondary text-sm">
        Search, sort, grouping and summaries always operate on the accessor's output, whichever of
        <code class="text-text-primary">cell</code>,
        <code class="text-text-primary">column.cell</code>,
        <code class="text-text-primary">column.component</code>
        and
        <code class="text-text-primary">column.formatter</code> renders the cell (first match wins,
        in that order). A badge or a currency format therefore never changes what a column sorts by.
        <a href={resolve('/table/custom-cells')} class="text-primary hover:underline"
          >Custom Cells</a
        > has the snippet and component recipes.
      </p>

      <p class="text-text-secondary text-sm">
        Five flags decide what a column can be asked to do. They are not independent, and two of
        them, <code class="text-text-primary">groupable</code> and
        <code class="text-text-primary">summable</code>, are off until something turns them on:
      </p>

      <div class="border-border-hairline overflow-x-auto border-y">
        <table class="w-full text-left text-sm">
          <thead class="text-text-primary border-border-hairline border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Flag</th>
              <th class="py-2 pr-4 font-semibold">Unset means</th>
              <th class="py-2 font-semibold">What it governs</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-hairline divide-y">
            {#each capabilityFlags as flag (flag.name)}
              <tr>
                <td class="py-2 pr-4"><code class="text-text-primary">{flag.name}</code></td>
                <td class="py-2 pr-4">{flag.unset}</td>
                <td class="py-2">{flag.governs}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">dataType</code> is the one to set first: it picks the filter
        operators the menu offers (<em>contains</em> for text, <em>after</em> / <em>before</em> for
        dates), the quick-values list, and, unless
        <code class="text-text-primary">summable</code> says otherwise, whether the column offers summaries.
      </p>

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">priority</code> decides only whether a column reaches the
        mobile card: <code class="text-text-primary">1</code> and unset and
        <code class="text-text-primary">2</code> do, <code class="text-text-primary">3</code> stays
        behind on the desktop table. Which of the ones that reach it becomes the card's title and
        subtitle is their order in the array, not their number. The card layout takes over when the
        table's <strong class="text-text-primary">own container</strong> is narrower than
        <code class="text-text-primary">cardsBelow</code>
        (default <code class="text-text-primary">'48rem'</code>), so a table in a narrow column
        switches while the window stays wide.
      </p>
    </div>
  </Section>

  <Section id="column-visibility" title="Column Visibility">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Users can hide and restore columns at runtime, through the eye icon in the SmartFilterBar,
        which lists every hideable column with a checkbox, or through each column's
        <code class="text-text-primary">⋮</code> header menu, which offers
        <em>Hide column</em> plus <em>Show "Column"</em> entries for currently hidden ones. Both are
        there on a plain <code class="text-text-primary">{'<Table>'}</code>: column visibility and
        the filter bar are on by default. Visibility choices persist across reloads once the table
        is given a
        <a href={resolve('/table/customization')} class="text-primary hover:underline">
          preferences storage key</a
        >.
      </p>

      <p class="text-text-secondary text-sm">
        Hiding a column narrows what the tools offer, not what they do. The sort, filter, grouping
        and summary editors list the columns the reader can currently see, so a hidden column drops
        out of them — but a sort or filter already running stays in force and keeps its own row
        there, still under the column's title rather than its raw accessor. Restore the column and
        the entry rejoins the list. When hiding leaves a tool with nothing to offer, it says so in
        its own words — <em>No column can be sorted</em>, <em>Every column is pinned</em> — instead of
        opening an empty menu, and its button stays reachable so that sentence can be read.
      </p>

      <CodeExample
        title="Always-Visible Columns and the Table-Level Switch"
        description={'Name carries hideable: false, so it has no hide action and is left out of the visibility menu. Set enableColumnVisibility={false} to turn the whole feature off.'}
        code={`const columns: Column<Employee>[] = [
  { accessor: 'name', title: 'Name', sortable: true, hideable: false }, // always visible
  { accessor: 'role', title: 'Role', sortable: true },
  { accessor: 'department', title: 'Department', sortable: true },
  { accessor: 'salary', title: 'Salary', sortable: true, dataType: 'number', align: 'right' }
];

<Table {items} {columns} />

<!-- disable hiding entirely -->
<Table {items} {columns} enableColumnVisibility={false} />`}
      >
        <Table
          cardsBelow="32rem"
          items={employees}
          columns={visibilityColumns}
          viewDefaults={{ pageSize: 5 }}
          enableSmartFilter={true}
        />
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
