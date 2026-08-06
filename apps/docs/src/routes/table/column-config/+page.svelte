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

  const columnProps = [
    {
      prop: 'accessor',
      desc: 'Row property name (primitive value) or function (item) => value. Omit it for synthetic columns (action buttons, derived visuals) — they carry no data.'
    },
    {
      prop: 'id',
      desc: 'Stable column identifier — required for function accessors and synthetic columns; defaults to the accessor name for string accessors'
    },
    {
      prop: 'title',
      desc: 'Column header label — may be an empty string for icon-only columns such as action columns'
    },
    {
      prop: 'menuTitle',
      desc: 'Name used wherever the column is referenced by name in table chrome (visibility, header, filter/group/summary menus) — falls back to title, then a humanized id. Set it on icon-only columns with an empty title.'
    },
    { prop: 'sortable', desc: 'Enable click-to-sort (default: false)' },
    {
      prop: 'searchable',
      desc: 'Include in SmartFilterBar search and the per-column filter menu (default: true)'
    },
    {
      prop: 'groupable',
      desc: 'Allow group-by via SmartFilterBar or header menu — follows `sortable` when unset'
    },
    {
      prop: 'summable',
      desc: 'Allow sum/avg/count via SmartFilterBar or header menu — auto-detected for number columns when unset'
    },
    {
      prop: 'dataType',
      desc: '"text" | "number" | "date" | "boolean" | "email" | "url" — drives which filter operators the filter menu offers, the filter input type, and number-column detection for summaries'
    },
    {
      prop: 'hideable',
      desc: 'Allow hiding via the visibility or header menu (default: true) — set false to pin a column as always-visible'
    },
    {
      prop: 'priority',
      desc: '1/unset = primary (mobile card title), 2 = secondary detail, 3 = desktop-only (hidden in card)'
    },
    { prop: 'align', desc: '"left" | "center" | "right" — cell text alignment' },
    { prop: 'width / minWidth', desc: 'Fixed or minimum column width (CSS string)' },
    { prop: 'flex', desc: 'Use flex layout inside the header cell' },
    {
      prop: 'formatter',
      desc: '(value, item) => string | null — plain-text cell formatting; applies only when neither cell nor component is set'
    },
    {
      prop: 'cell',
      desc: 'Snippet (item, value) for custom cell rendering — takes precedence over component and formatter'
    },
    {
      prop: 'component',
      desc: 'Svelte component rendered for the cells of this column — receives the row item as a prop'
    },
    {
      prop: 'componentProps',
      desc: '(item) => props factory for component — the item itself is always passed automatically'
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

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Column Properties Reference</h4>
        <div class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each columnProps as item (item.prop)}
            <div>
              <code class="text-primary text-xs">{item.prop}</code>
              <p class="text-text-tertiary text-xs">{item.desc}</p>
            </div>
          {/each}
        </div>
      </div>
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
        description="Name is pinned via hideable: false — it has no hide action and is omitted from the visibility menu. Set enableColumnVisibility={false} to turn the whole feature off."
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
