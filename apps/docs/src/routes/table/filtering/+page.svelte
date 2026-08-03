<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { Input, Slider } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose, type Employee } from '../_data';

  const navigation = [
    { id: 'filtering', title: 'Smart Filter Bar' },
    { id: 'tools-sheet', title: 'Narrow Bar & Tools Sheet' },
    { id: 'filter-operators', title: 'Filter Operators' },
    { id: 'controlled-search', title: 'Controlled Search' }
  ];

  let searchTerm = $state('');

  // ── Narrow-bar demo ────────────────────────────────────────────────────────
  //
  // Two summable columns so the sheet's Summary section has more than one row —
  // `salary` says so explicitly, `projects` inherits it from `dataType: 'number'`
  // (both routes into isColumnSummable). `department` carries the grouping, and
  // every column here has an accessor, so all four appear in filter and sort.
  const toolsColumns: Column<Employee>[] = [
    { accessor: 'name', title: 'Name', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    {
      accessor: 'salary',
      title: 'Salary',
      sortable: true,
      summable: true,
      dataType: 'number',
      align: 'right'
    },
    { accessor: 'projects', title: 'Projects', sortable: true, dataType: 'number', align: 'right' }
  ];

  /** The bar's own switch, in the bar's own units. */
  const COMPACT_MAX_WIDTH = 28 * 16;

  /**
   * What the bar spends on itself before any of that width reaches the content
   * box it measures: `p-3` on both sides at `size="md"` plus its 1px border. The
   * container therefore has to be this much wider than the threshold — the exact
   * gap that made this state so easy to miss.
   */
  const BAR_CHROME = 2 * 12 + 2 * 1;

  const TIPPING_POINT = COMPACT_MAX_WIDTH + BAR_CHROME;

  let demoWidth = $state(360);

  // `range` is off, so the value is always scalar; the tuple branch exists only
  // because the prop type covers both slider modes.
  function formatDemoWidth(value: number | [number, number]): string {
    const width = typeof value === 'number' ? value : value[0];
    return `${width}px container · ${width - BAR_CHROME}px bar content box`;
  }

  const codeNarrowBar = `<!-- The bar measures its own CONTENT box, so the wrapper has to be
     narrower than 28rem plus the bar's padding and border (~474px at
     size="md") — max-w-md is exactly 28rem and still trips the switch.
     Nothing is opted into here; the bar decides by itself. -->
<div class="max-w-sm">
  <Table {items} {columns} enableSmartFilter />
</div>`;

  const operators = [
    {
      op: 'contains',
      desc: 'Case-insensitive substring match. Offered for text columns (the default).'
    },
    {
      op: 'equals',
      desc: 'Case-insensitive exact match on the stringified value. Offered for text, number, and date columns (labeled "on date" for dates).'
    },
    {
      op: 'startsWith',
      desc: 'Case-insensitive prefix match. Offered for text columns.'
    },
    {
      op: 'endsWith',
      desc: 'Case-insensitive suffix match. Offered for text columns.'
    },
    {
      op: 'greaterThan',
      desc: 'Numeric comparison when both sides convert via Number(), otherwise a date comparison. Offered for number columns and as "after" for date columns.'
    },
    {
      op: 'lessThan',
      desc: 'Numeric comparison when both sides convert via Number(), otherwise a date comparison. Offered for number columns and as "before" for date columns.'
    }
  ];

  const codeControlledSearch = `${scriptOpen}
  let searchTerm = $state('');
${scriptClose}

<Input bind:value={searchTerm} label="Search from outside the table" clearable />

<Table
  {items}
  {columns}
  {searchTerm}
  onSearchTermChange={(term) => (searchTerm = term)}
/>`;
</script>

<SeoMeta
  title="Filtering & Search - Table"
  description="Built-in search, column filters, summary controls, and column visibility via the SmartFilterBar — plus a controlled search term for external search UIs."
/>

<DocsPageLayout
  title="Filtering & Search"
  description="Built-in search, column filters, summary controls, and column visibility via the SmartFilterBar — plus a controlled search term for external search UIs."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="filtering" title="Smart Filter Bar">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableSmartFilter</code> to get a full-featured toolbar
        with search, per-column filters, grouping controls, summary aggregations, and a column visibility
        menu.
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

  <Section id="tools-sheet" title="Narrow Bar &amp; Tools Sheet">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        The bar's five tools — filters, sort, grouping, summaries and column visibility — normally
        sit in a capsule beside the search field. Below
        <strong class="text-text-primary">28rem (448px)</strong> of bar width that capsule is gone: the
        tools move into a bottom sheet reached from a single button. Nothing is taken away, only relocated
        — each tool becomes a section of the sheet, rebuilt as a form instead of a menu. Sort, for instance,
        splits into a column list plus a separate direction control rather than offering every column×direction
        pair; summaries become one aggregation choice per summable column, which is why this demo declares
        two numeric columns.
      </p>

      <p class="text-text-secondary text-sm">
        Drag the slider to squeeze the container past the threshold, then open the sheet. The switch
        is automatic — there is no prop for it. Note that the sheet is a bottom
        <a href={resolve('/blocks/primitives/drawer')} class="text-primary hover:underline"
          >Drawer</a
        >, so it spans the
        <em>window</em>, not the bar: on a desktop screen it will look far wider than the table that
        opened it. On the phone-sized layouts this mode is built for, the two are the same width.
      </p>

      <div class="space-y-4">
        <Slider
          bind:value={demoWidth}
          min={320}
          max={640}
          step={2}
          label="Container width"
          showValue
          formatValue={formatDemoWidth}
          marks={[{ value: TIPPING_POINT, label: 'switch' }]}
        />

        <div style="width: {demoWidth}px; max-width: 100%">
          <Table
            items={employees}
            columns={toolsColumns}
            enableSmartFilter={true}
            searchPlaceholder="Search employees..."
            initialSort={{ column: 'salary', direction: 'desc' }}
            itemsPerPage={5}
          />
        </div>
      </div>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary"
          >The width is measured on the bar, not on the window.</strong
        >
        A filter bar can sit in a card, a drawer, a split pane or a dashboard tile, so a viewport media
        query would happily leave a 400px bar in the wide layout it has no room for. The bar observes
        its own
        <strong class="text-text-primary">content box</strong> with a
        <code class="text-text-primary">ResizeObserver</code> instead — the box a
        <code class="text-text-primary">@container</code> query measures, which is why the threshold
        is the same <code class="text-text-primary">28rem</code> step the bar's own
        <code class="text-text-primary">@container</code> rules use to switch between stacked and
        row layout. The capsule can therefore never end up in a layout too narrow to hold it.
        Reading
        <code class="text-text-primary">clientWidth</code> instead would include the bar's own padding
        and leave a 24px band where neither switch fires.
      </p>

      <p class="text-text-secondary text-sm">
        Only <code class="text-text-primary">layout="responsive"</code> — the default — switches.
        <code class="text-text-primary">horizontal</code> and
        <code class="text-text-primary">vertical</code> are explicit instructions from the consumer and
        are left alone at any width. Growing back past the threshold closes the sheet, so a bar that is
        narrowed again does not re-open it unprompted.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">The badge on the button counts tools, not results.</strong
        >
        With the sheet shut, the lit triggers inside it are invisible, so the button carries the number
        of things currently acting on the grid: one each for active filters (however many), a sort column,
        a grouping, a summary row that is switched on, and hidden columns — at most five. The demo starts
        at 1 because it seeds
        <code class="text-text-primary">initialSort</code>; add a filter or a grouping in the sheet
        and watch it climb. Hidden columns count too — a column that is not on screen changes what
        the reader sees just as much as a filter does.
      </p>

      <CodeExample
        title="Reproducing It"
        description="Any container narrower than the threshold trips the switch — no prop, no media query, no viewport resize needed."
        code={codeNarrowBar}
        preview={false}
      />
    </div>
  </Section>

  <Section id="filter-operators" title="Filter Operators">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Per-column filters are added through the filter button in the SmartFilterBar. Each filter is
        a plain object — <code class="text-text-primary">&#123; column, operator, value &#125;</code
        >
        — and every active filter must match for a row to stay visible (AND semantics).
        <code class="text-text-primary">value</code> is always a string, even for the comparing
        operators — the comparison converts internally, which keeps filters serializable for
        persistence. Which operators the menu offers is driven by the column's
        <code class="text-text-primary">dataType</code>; columns with
        <code class="text-text-primary">searchable: false</code> (and synthetic columns without an accessor)
        do not appear in the filter menu at all.
      </p>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h3 class="text-text-primary mb-4 text-sm font-semibold">Operator Reference</h3>
        <div class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each operators as item (item.op)}
            <div>
              <code class="text-primary text-xs">{item.op}</code>
              <p class="text-text-tertiary text-xs">{item.desc}</p>
            </div>
          {/each}
        </div>
      </div>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">Comparing operators resolve in two steps.</strong>
        If the cell value and the filter value both convert via
        <code class="text-text-primary">Number()</code>, they are compared as numbers. Otherwise
        both sides are read as instants —
        <code class="text-text-primary">Date</code> objects, numbers (epoch milliseconds) and
        ISO-8601 strings (<code class="text-text-primary">2021-03-15</code>,
        <code class="text-text-primary">2021-03-15T09:00</code>,
        <code class="text-text-primary">2021-03-15T09:00:00Z</code>). Any other string format never
        matches, so a malformed or empty value filters everything out instead of matching
        everything.
      </p>

      <p class="text-text-secondary text-sm">
        A <code class="text-text-primary">date</code> column's filter input emits a bare calendar
        date (<code class="text-text-primary">YYYY-MM-DD</code>), and for that shape
        <em>after</em>/<em>before</em> compare on
        <strong class="text-text-primary">UTC day boundaries</strong>: "after 2021-03-15" starts at
        the following midnight UTC and "before 2021-03-15" ends at that day's midnight UTC — a row
        stamped <code class="text-text-primary">2021-03-15T09:00Z</code> matches neither. A filter
        value that carries a time of day compares instants strictly. Since a date-only string parses
        as UTC midnight while a date-time string without an offset parses as local time, a
        <code class="text-text-primary">Date</code> built from local parts (<code
          class="text-text-primary">new Date(2021, 2, 15)</code
        >) can fall into the neighbouring UTC day — store ISO strings or UTC-constructed dates for
        day-exact filtering.
      </p>

      <p class="text-text-secondary text-sm">
        To start with filters active, pass
        <code class="text-text-primary">initialFilters</code> — an array of the same
        <code class="text-text-primary">&#123; column, operator, value &#125;</code> objects. It
        seeds the uncontrolled filter state once (the chips show them; users can still remove or add
        filters), and filters restored via
        <code class="text-text-primary">persistenceConfig</code>
        (<code class="text-text-primary">persistFilters</code>) take precedence.
      </p>

      <p class="text-text-secondary text-sm">
        Both search and filters match against the column accessor's output — not against what a
        custom cell renders. In
        <code class="text-text-primary">mode="server"</code> the table does not filter locally:
        active filters arrive as <code class="text-text-primary">activeFilters</code> on the query
        object — see
        <a href={resolve('/table/remote-data')} class="text-primary hover:underline">Remote Data</a
        >.
      </p>
    </div>
  </Section>

  <Section id="controlled-search" title="Controlled Search">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        By default the search term is internal, uncontrolled state. Pass the
        <code class="text-text-primary">searchTerm</code> prop to control it from outside — the prop
        then drives the table's search, and
        <code class="text-text-primary">onSearchTermChange</code> fires on every internal change
        (typing in the SmartFilterBar, Escape-to-clear) so you can write the value back. An empty
        string is a valid controlled value ("no search"); leave the prop
        <code class="text-text-primary">undefined</code> for uncontrolled search. A controlled term
        takes precedence over a persisted one (<code class="text-text-primary"
          >persistenceConfig.persistSearch</code
        >). <code class="text-text-primary">onSearchTermChange</code> also works on its own to observe
        the uncontrolled value — for example to mirror it into the URL.
      </p>

      <CodeExample
        title="External Search Field"
        description="The input and the table's own SmartFilterBar stay in sync: the input drives searchTerm, and onSearchTermChange writes internal changes back."
        code={codeControlledSearch}
      >
        <div class="space-y-4">
          <Input
            bind:value={searchTerm}
            label="Search from outside the table"
            placeholder="Try 'platform' or 'berlin'..."
            clearable
          />
          <Table
            items={employees}
            columns={basicColumns}
            {searchTerm}
            onSearchTermChange={(term) => (searchTerm = term)}
            itemsPerPage={6}
          />
        </div>
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
