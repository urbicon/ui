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
      governs: 'the search field and the column’s own filter entry — one flag for both'
    },
    {
      name: 'groupable',
      unset: 'follows sortable',
      governs: 'the header menu and the toolbar’s grouping tool'
    },
    {
      name: 'summable',
      unset: "follows dataType: 'number'",
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
  description="Rich column properties to control sorting, filtering, grouping, summaries, visibility, responsive priority, and custom cell rendering."
/>

<DocsPageLayout
  title="Column Configuration"
  description="Rich column properties to control sorting, filtering, grouping, summaries, visibility, responsive priority, and custom cell rendering."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
  showToc={true}
>
  <Section id="column-config" title="Column Properties">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Each column object supports a rich set of properties to control sorting, filtering,
        grouping, summaries, visibility, responsive priority, and custom cell rendering.
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
    priority: 1            // primary; first card column, so it is the card title
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
    align: 'right',
    formatter: (value) => \`$\${Number(value).toLocaleString()}\` // display only —
                           // sort/search/summary still use the raw accessor value
  },
  {
    accessor: 'status',
    title: 'Status',
    sortable: false,       // disable sorting for this column
    searchable: false      // exclude from search and the filter menu
  },
  {
    accessor: 'notes',
    title: 'Notes',
    priority: 3            // desktop-only — omitted from the mobile card
  },
  {
    id: 'actions',         // synthetic column — no accessor, id is required
    title: '',             // icon-only header stays blank
    menuTitle: 'Actions',  // name shown in the visibility + header menus
    hideable: false,       // pinned — cannot be hidden
    component: RowActions  // your Svelte component, receives { item }
  }
];`}
        language="typescript"
      >
        <Table
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
        <strong class="text-text-primary">synthetic column</strong> without any accessor — typically
        action buttons. Synthetic columns are structurally excluded from
        <code class="text-text-primary">sortable</code>/<code class="text-text-primary"
          >searchable</code
        >/<code class="text-text-primary">groupable</code>/<code class="text-text-primary"
          >summable</code
        >/<code class="text-text-primary">dataType</code> — there is no value to operate on, and the type
        rejects those flags at compile time.
      </p>

      <p class="text-text-secondary text-sm">
        Cell rendering follows a fixed priority — first match wins: the table-level
        <code class="text-text-primary">cell</code> snippet, then
        <code class="text-text-primary">column.cell</code>, then
        <code class="text-text-primary">column.component</code>, then
        <code class="text-text-primary">column.formatter</code>, then the raw accessor value.
        Whichever path renders, search, sort, group, and summaries always operate on the accessor
        output — display and derived operations are decoupled by design. See
        <a href={resolve('/table/custom-cells')} class="text-primary hover:underline">
          Custom Cells</a
        > for snippet and component recipes.
      </p>

      <p class="text-text-secondary text-sm">
        Five flags decide what a column can be asked to do. They are not independent, and two of
        them are off until something turns them on:
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
        operators the menu offers, the alignment, and whether the column can be summed at all. And
        <code class="text-text-primary">priority</code> decides only whether a column reaches the mobile
        card — which of the ones that do becomes the card's title and subtitle is their order in the array,
        not their number.
      </p>
    </div>
  </Section>

  <Section id="column-visibility" title="Column Visibility">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Users can hide and restore columns at runtime — through the eye icon in the SmartFilterBar,
        which lists every hideable column with a checkbox, or through each column's
        <code class="text-text-primary">⋮</code> header menu, which offers
        <em>Hide column</em> plus <em>Show "Column"</em> entries for currently hidden ones. The
        feature is on by default; visibility choices persist across reloads once the table is given
        a
        <a href={resolve('/table/customization')} class="text-primary hover:underline">
          preferences storage key</a
        >.
      </p>

      <CodeExample
        title="Pinned Columns and the Table-Level Switch"
        description={'Name is pinned via hideable: false — it has no hide action and is omitted from the visibility menu. Set enableColumnVisibility={false} to turn the whole feature off.'}
        code={`const columns: Column<Employee>[] = [
  { accessor: 'name', title: 'Name', sortable: true, hideable: false }, // pinned
  { accessor: 'role', title: 'Role', sortable: true },
  { accessor: 'department', title: 'Department', sortable: true },
  { accessor: 'salary', title: 'Salary', sortable: true, dataType: 'number', align: 'right' }
];

<Table {items} {columns} />

<!-- disable hiding entirely -->
<Table {items} {columns} enableColumnVisibility={false} />`}
      >
        <Table
          items={employees}
          columns={visibilityColumns}
          viewDefaults={{ pageSize: 5 }}
          enableSmartFilter={true}
        />
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
