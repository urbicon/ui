<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table, createTableView, type Column } from '@urbicon-ui/table';
  import { Input, Slider } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose, type Employee } from '../_data';

  const navigation = [
    { id: 'filtering', title: 'Smart Filter Bar' },
    { id: 'tools-sheet', title: 'Narrow Bar & Tools Sheet' },
    { id: 'filter-operators', title: 'Filter Operators' },
    { id: 'external-search', title: 'Search from Outside' }
  ];

  // ── External-search demo ───────────────────────────────────────────────────
  //
  // The view belongs to this page, so the search axis is ours to write. Writing
  // an axis does not subscribe this effect to it — only `term` decides when it
  // runs — so the table's own search field keeps working alongside.
  const view = createTableView({ defaults: { pageSize: 6 } });
  let term = $state('');

  $effect(() => {
    view.search = term;
    view.page = 1; // a direct field write does not reset the page
  });

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

  /**
   * The bar's own switch, copied from `COMPACT_MAX_WIDTH` in
   * `packages/table/src/lib/features/SmartFilterBar/SmartFilterBar.svelte` —
   * a hardcoded `28 * 16` there, so a hardcoded 448 here. Nothing links the two;
   * if the library ever moves that number, the `switch` mark below and the three
   * figures in the prose move with it by hand.
   *
   * The bar's own padding and border are deliberately NOT copied — they are
   * measured off the live element instead (see `measured`), because that is the
   * part most likely to drift and the part this whole section is about.
   */
  const COMPACT_MAX_WIDTH = 448;

  let demoWidth = $state(360);

  /**
   * The bar's real geometry, read off the DOM rather than derived from the
   * slider.
   *
   * The slider says what was asked for; the box below caps itself with
   * `max-width`, so it shrinks to whatever the column really has and the two
   * part ways on a narrow screen — ask for 640px inside a 342px column and you
   * get 342. Printing the slider value there would have the readout claim a
   * width the bar never had, on exactly the phone-sized layouts this mode
   * exists for.
   */
  let measured = $state<{ container: number; contentBox: number } | null>(null);

  /** Measures the demo's bar for the readout. Attached to the width wrapper. */
  function measureBar(host: HTMLElement) {
    const read = () => {
      // The SmartFilterBar root — the same element its own ResizeObserver
      // watches. Measuring the wrapper instead would reproduce the very mistake
      // this section documents.
      const bar = host.querySelector('[data-table-toolbar] > *');
      if (!(bar instanceof HTMLElement)) {
        measured = null;
        return;
      }
      const cs = getComputedStyle(bar);
      const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
      const next = {
        container: Math.round(host.getBoundingClientRect().width),
        contentBox: Math.round(bar.clientWidth - padX)
      };
      // The query above reaches into Table's own markup. If a wrapper ever lands
      // between the toolbar slot and the bar, it resolves to the wrapper instead
      // — which has no padding, so the chrome silently reads 0 and the switch
      // mark drifts onto the threshold itself. Bound it: `p-3` plus a border is
      // 26px at `md`, and nothing in the size scale gets near 64.
      const chrome = next.container - next.contentBox;
      measured = chrome > 0 && chrome <= 64 ? next : null;
    };

    const ro = new ResizeObserver(read);
    ro.observe(host);
    read();
    // The table renders its toolbar as a child of this host, so on the very
    // first pass the query above can run before it exists.
    const raf = requestAnimationFrame(read);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }

  /** Chrome measured off the live bar, not assumed: padding + border. */
  const barChrome = $derived(measured ? measured.container - measured.contentBox : null);

  /** The container width at which the content box is exactly at the threshold. */
  const tippingPoint = $derived(barChrome === null ? null : COMPACT_MAX_WIDTH + barChrome);

  const readout = $derived.by(() => {
    if (!measured) return 'Measuring the bar…';
    const base = `${measured.container}px container · ${measured.contentBox}px bar content box`;
    return measured.container < demoWidth
      ? `${base} — clamped by the page, so the slider cannot reach ${demoWidth}px here`
      : base;
  });

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

  const codeExternalSearch = `${scriptOpen}
  import { Table, createTableView } from '@urbicon-ui/table';

  const view = createTableView({ defaults: { pageSize: 6 } });
  let term = $state('');

  // Outside → view. Writing an axis never subscribes the effect to it, so the
  // table's own search field keeps working alongside this one.
  $effect(() => {
    view.search = term;
    view.page = 1; // a direct field write does not reset the page
  });
${scriptClose}

<Input bind:value={term} label="Search from outside the table" clearable />

<p>The table is searching for: <code>{view.search || '—'}</code></p>

<Table {items} {columns} {view} />`;
</script>

<SeoMeta
  title="Filtering & Search - Table"
  description="Built-in search, column filters, summary controls, and column visibility via the SmartFilterBar — plus an external search field wired through the table's view."
/>

<DocsPageLayout
  title="Filtering & Search"
  description="Built-in search, column filters, summary controls, and column visibility via the SmartFilterBar — plus an external search field wired through the table's view."
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
  viewDefaults={{ pageSize: 6 }}
/>`}
      >
        <Table
          items={employees}
          columns={basicColumns}
          enableSmartFilter={true}
          searchPlaceholder="Search employees..."
          searchDebounceMs={300}
          viewDefaults={{ pageSize: 6 }}
        />
      </CodeExample>
    </div>
  </Section>

  <Section id="tools-sheet" title="Narrow Bar &amp; Tools Sheet">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        The bar's tools — filters, sort, grouping, summaries and column visibility — normally sit in
        a capsule beside the search field. Below
        <strong class="text-text-primary">28rem (448px) of bar content box</strong> that capsule is gone:
        the tools move into a bottom sheet reached from a single button. Nothing is taken away, only relocated
        — each tool becomes a section of the sheet, rebuilt as a form instead of a menu. Sort, for instance,
        splits into a column list plus a separate direction control rather than offering every column×direction
        pair; summaries become one aggregation choice per summable column, which is why this demo declares
        two numeric columns.
      </p>

      <p class="text-text-secondary text-sm">
        There are <strong class="text-text-primary">up to five</strong> of them, not always five,
        and the sheet mirrors the capsule exactly: grouping drops out while the table is
        <code class="text-text-primary">virtualized</code>, column visibility when
        <code class="text-text-primary">enableColumnVisibility</code> is off. Three is the floor. The
        demo below has all five.
      </p>

      <p class="text-text-secondary text-sm">
        Drag the slider to squeeze the container past the threshold, then open the sheet. The switch
        is automatic — there is no prop for it. The readout is measured off the live bar rather than
        computed from the slider, so if the page is too narrow to give the demo the width it asks
        for, it says so instead of printing a number the bar never had. Note also that the sheet is
        a bottom
        <a href={resolve('/blocks/primitives/drawer')} class="text-primary hover:underline"
          >Drawer</a
        >, so it spans the
        <em>window</em>, not the bar: here a 360px table opens a full-width sheet. That gap closes
        when the bar is roughly the width of the window, which is the common phone case — but a bar
        inside a card is narrower than the sheet on a phone too.
      </p>

      <div class="space-y-4">
        <Slider
          bind:value={demoWidth}
          min={320}
          max={640}
          step={2}
          label="Container width"
          helper={readout}
          marks={tippingPoint === null ? [] : [{ value: tippingPoint, label: 'switch' }]}
        />

        <!--
          `max-width`, not `width`. A fixed `width` makes this box's min-content
          contribution 640px, which the `flex-1` main column (min-width: auto)
          honours by growing past the viewport — at 390px the whole page picked
          up a horizontal scrollbar and `max-width: 100%` never bit, because the
          parent had grown too. Capping instead lets the box shrink to whatever
          the column really has, which is what the readout then reports.
        -->
        <div {@attach measureBar} class="w-full" style="max-width: {demoWidth}px">
          <Table
            items={employees}
            columns={toolsColumns}
            enableSmartFilter={true}
            searchPlaceholder="Search employees..."
            viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
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
        <code class="text-text-primary">@container</code> query measures. Reading
        <code class="text-text-primary">clientWidth</code> would include the bar's own padding and
        leave a dead band (24px at <code class="text-text-primary">size="md"</code>) where neither
        this switch nor the row/stack one fires.
      </p>

      <p class="text-text-secondary text-sm">
        The threshold is meant to line up with the <code class="text-text-primary">28rem</code> step
        the bar's own <code class="text-text-primary">@container</code> rules use for the
        stacked/row switch, so that the capsule is not left standing in a layout too narrow to hold
        it. The two line up <strong class="text-text-primary">at a 16px root font size</strong>,
        which is the default and the common case — but only there: the tool switch compares a
        hardcoded 448px, while <code class="text-text-primary">@container</code> resolves
        <code class="text-text-primary">28rem</code> against the root. Raise the browser's text size
        and a band opens between them in which the capsule is back under the search field. Tracked
        as
        <a
          href="https://github.com/urbicon/ui/issues/133"
          class="text-primary hover:underline"
          rel="noreferrer">#133</a
        >.
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
        at 1 because its
        <code class="text-text-primary">viewDefaults</code> seed a sort; add a filter or a grouping in
        the sheet and watch it climb. Hidden columns count too — a column that is not on screen changes
        what the reader sees just as much as a filter does.
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
        <code class="text-text-primary"
          >viewDefaults=&#123;&#123; filters: [&hellip;] &#125;&#125;</code
        >
        — an array of the same
        <code class="text-text-primary">&#123; column, operator, value &#125;</code> objects. That
        is the view's baseline: the chips show them, users can still remove or add filters, and
        <code class="text-text-primary">bindViewToStorage(view, &#123; key &#125;)</code> applies a stored
        set over it after hydration.
      </p>

      <p class="text-text-secondary text-sm">
        Both search and filters match against the column accessor's output — not against what a
        custom cell renders. With a server source (<code class="text-text-primary"
          >source=&#123;&#123; query &#125;&#125;</code
        >
        or
        <code class="text-text-primary"
          >source=&#123;&#123; kind: 'server', &hellip; &#125;&#125;</code
        >) the table does not filter locally: active filters arrive as
        <code class="text-text-primary">activeFilters</code> on the query object — see
        <a href={resolve('/table/remote-data')} class="text-primary hover:underline">Remote Data</a
        >.
      </p>
    </div>
  </Section>

  <Section id="external-search" title="Search from Outside">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        The search term is one of the six axes of the table's view. Hand the table a view of your
        own — <code class="text-text-primary">createTableView()</code> — and the axis is yours: an
        effect pushes your field into <code class="text-text-primary">view.search</code>, and
        reading it back is just <code class="text-text-primary">view.search</code>, with no callback
        in between. The table's own search field writes the same axis, so the readout below shows
        what the table is filtering by, whichever of the two was typed into last.
      </p>

      <p class="text-text-secondary text-sm">
        One thing comes with writing a field directly: it
        <strong class="text-text-primary">does not reset the page</strong> — the table's own
        handlers do that on a new search, so write
        <code class="text-text-primary">view.page = 1</code> alongside if you want the same behaviour.
        Writing an axis does not subscribe the effect to it, so the effect above runs when your field
        changes and not when the table writes the same axis.
      </p>

      <p class="text-text-secondary text-sm">
        Steering an axis from outside and persisting the view are independent. An axis whose value
        comes from outside is usually one you do not want stored — name the others instead:
        <code class="text-text-primary"
          >bindViewToStorage(view, &#123; key: 'employees', axes: ['sort', 'filters', 'pageSize',
          'groupBy'] &#125;)</code
        >.
      </p>

      <CodeExample
        title="External Search Field"
        description="One view, two writers: the input pushes into view.search, the table's own search field writes the same axis, and the readout reads it straight back."
        code={codeExternalSearch}
      >
        <div class="space-y-4">
          <Input
            bind:value={term}
            label="Search from outside the table"
            placeholder="Try 'platform' or 'berlin'..."
            clearable
          />
          <p class="text-text-tertiary text-xs">
            The table is searching for:
            <code class="text-text-primary">{view.search || '—'}</code>
          </p>
          <Table items={employees} columns={basicColumns} {view} />
        </div>
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
