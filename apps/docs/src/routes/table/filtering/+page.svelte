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
  // The view belongs to this page, so the search setting is ours to write.
  // Writing a setting does not subscribe this effect to it — only `term` decides
  // when it runs — so the table's own search field keeps working alongside.
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
   * Where to put the `switch` mark on the slider: 28rem, the container step the
   * bar's own `@container` rules use, resolved against THIS page's root font.
   *
   * It used to say `448` and explain that it copied a hardcoded `28 * 16` from
   * the library. The library has no such number any more — CSS declares the
   * threshold once and the bar reads it (#133) — so copying a pixel value would
   * now be the only place a second one exists. Reading `28rem` off the document
   * keeps the mark honest at any text size, which is exactly the failure the fix
   * removed.
   *
   * The bar's own padding and border are deliberately NOT copied either — they
   * are measured off the live element (see `measured`), because that is the part
   * most likely to drift and the part this whole section is about.
   */
  const COMPACT_MAX_WIDTH = $derived.by(() => {
    if (typeof document === 'undefined') return 448;
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
    return 28 * (Number.isFinite(root) && root > 0 ? root : 16);
  });

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
     size="md"): max-w-md is exactly 28rem and still trips the switch. -->
<div class="max-w-sm">
  <Table {items} {columns} enableSmartFilter />
</div>`;

  // Which operator the menu offers for which `dataType` is `OPERATORS_BY_TYPE`
  // in SmartFilterBar/FilterPanel.svelte; the matching itself is `useFiltering`.
  const operators = [
    {
      op: 'contains',
      matches: 'Substring, case-insensitive',
      offeredFor: 'text (the default)'
    },
    {
      op: 'equals',
      matches: 'The whole stringified value, case-insensitive; on a date column, the whole UTC day',
      offeredFor: 'text, number, date (labelled “on date”)'
    },
    { op: 'startsWith', matches: 'Prefix, case-insensitive', offeredFor: 'text' },
    { op: 'endsWith', matches: 'Suffix, case-insensitive', offeredFor: 'text' },
    {
      op: 'greaterThan',
      matches: 'Numbers when both sides convert, instants otherwise',
      offeredFor: 'number, date (labelled “after”)'
    },
    {
      op: 'lessThan',
      matches: 'Numbers when both sides convert, instants otherwise',
      offeredFor: 'number, date (labelled “before”)'
    }
  ];

  const codeExternalSearch = `${scriptOpen}
  import { Table, createTableView } from '@urbicon-ui/table';

  const view = createTableView({ defaults: { pageSize: 6 } });
  let term = $state('');

  // Outside → view. The table's own search field keeps working alongside this
  // one, and writing here never re-runs this effect.
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
  showToc={true}
>
  <Section id="filtering" title="Smart Filter Bar">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableSmartFilter</code> to get a toolbar with
        search, per-column filters, grouping controls, summary aggregations, and a column visibility
        menu. Which columns take part is decided on the column, not on the bar: a column with an
        accessor is searched and gets its own filter entry unless it carries
        <code class="text-text-primary">searchable: false</code>, and its
        <code class="text-text-primary">dataType</code> decides which operators that filter offers (<a
          href={resolve('/table/column-config')}
          class="text-primary hover:underline">Column Configuration</a
        >).
      </p>

      <CodeExample
        title="Smart Filter Bar"
        description="Search across all searchable columns. Add per-column filters via the filter button. searchDebounceMs waits out every edit, clearing included: the term reaches the table 300ms after the last keystroke."
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
          cardsBelow="32rem"
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
        <strong class="text-text-primary">28rem of bar content box</strong> that capsule is gone: the
        tools move into a bottom sheet reached from a single button. Nothing is taken away, only relocated.
        Each tool becomes a section of the sheet, rebuilt as a form instead of a menu: sort splits into
        a column list plus a separate direction control rather than offering every column×direction pair,
        and summaries become one aggregation choice per summable column (which is why this demo declares
        two numeric columns).
      </p>

      <p class="text-text-secondary text-sm">
        The sheet mirrors the capsule exactly, including what is missing from it: grouping drops out
        while the table is <code class="text-text-primary">virtualized</code>, column visibility
        when
        <code class="text-text-primary">enableColumnVisibility</code> is off. The demo below has all five
        tools.
      </p>

      <p class="text-text-secondary text-sm">
        Drag the slider to squeeze the container past the threshold, then open the sheet. The switch
        is automatic; there is no prop for it. The sheet is a bottom
        <a href={resolve('/blocks/primitives/drawer')} class="text-primary hover:underline"
          >Drawer</a
        >, so it spans the
        <em>window</em>, not the bar: here a 360px table opens a full-width sheet. On a phone the
        two are usually the same width, though a bar inside a card is narrower than the sheet there
        too.
      </p>

      <div class="w-full space-y-4">
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
            cardsBelow="32rem"
            items={employees}
            columns={toolsColumns}
            enableSmartFilter={true}
            searchPlaceholder="Search employees..."
            viewDefaults={{ sort: { column: 'salary', direction: 'desc' }, pageSize: 5 }}
          />
        </div>
      </div>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">This is not the table's own layout switch.</strong> Rows
        become cards below <code class="text-text-primary">cardsBelow</code> of the table's
        container (<code class="text-text-primary">48rem</code> by default), which is why the demo
        above is a card list at every width the slider reaches. The bar's
        <code class="text-text-primary">28rem</code> is separate from it and has no prop: set
        <code class="text-text-primary">cardsBelow</code> to move the rows-to-cards step, and the tools
        keep switching where they always did.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary"
          >The width is measured on the bar, not on the window.</strong
        >
        A filter bar can sit in a card, a drawer, a split pane or a dashboard tile, so a viewport media
        query would happily leave a 400px bar in the wide layout it has no room for. The threshold is
        one <code class="text-text-primary">28rem</code> container step, the same one that stacks the
        search field above the tools, and it resolves against your root font size: at a larger text size
        the same bar moves its tools into the sheet at a larger pixel width.
      </p>

      <p class="text-text-secondary text-sm">
        Only <code class="text-text-primary">layout="responsive"</code>, the bar's default,
        switches.
        <code class="text-text-primary">horizontal</code> and
        <code class="text-text-primary">vertical</code> are explicit instructions and are left alone
        at any width; all three live on
        <code class="text-text-primary">SmartFilterBar</code>, which you render yourself through the
        table's <code class="text-text-primary">toolbar</code> snippet when you need one of them. Growing
        back past the threshold closes the sheet, so a bar that is narrowed again does not re-open it
        unprompted.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">The badge on the button counts tools, not results.</strong
        >
        With the sheet shut, the lit triggers inside it are invisible, so the button carries the number
        of things currently acting on the grid, at most five: one each for active filters (however many),
        a sort column, a grouping, a summary row that is switched on, and hidden columns. The demo starts
        at 1 because its
        <code class="text-text-primary">viewDefaults</code> seed a sort; add a filter or a grouping in
        the sheet and watch it climb. Hidden columns count too, because a column that is not on screen
        changes what the reader sees just as much as a filter does.
      </p>

      <CodeExample
        title="Reproducing It"
        description="Any container narrower than the threshold trips the switch: no prop, no media query, no viewport resize needed."
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
        persistence. The six operators below are the whole of
        <code class="text-text-primary">FilterOperator</code>; which of them the menu offers is
        driven by the column's <code class="text-text-primary">dataType</code>, and a type with no
        set of its own (<code class="text-text-primary">boolean</code>,
        <code class="text-text-primary">email</code>, <code class="text-text-primary">url</code>)
        gets the text operators. Columns with
        <code class="text-text-primary">searchable: false</code> (and synthetic columns without an accessor)
        do not appear in the filter menu at all.
      </p>

      <div class="border-border-hairline overflow-x-auto border-y">
        <table class="w-full text-left text-sm">
          <thead class="text-text-primary border-border-hairline border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Operator</th>
              <th class="py-2 pr-4 font-semibold">Matches</th>
              <th class="py-2 font-semibold">Offered for</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-hairline divide-y">
            {#each operators as item (item.op)}
              <tr>
                <td class="py-2 pr-4"><code class="text-text-primary">{item.op}</code></td>
                <td class="py-2 pr-4">{item.matches}</td>
                <td class="py-2">{item.offeredFor}</td>
              </tr>
            {/each}
          </tbody>
        </table>
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
        matches, so a malformed value filters everything out instead of matching everything. An
        empty
        <code class="text-text-primary">value</code> is not an assertion at all and keeps every row, whichever
        operator it carries; the filter menu never produces one, but a seeded or stored filter can.
      </p>

      <p class="text-text-secondary text-sm">
        A <code class="text-text-primary">date</code> column's filter input emits a bare calendar
        date (<code class="text-text-primary">YYYY-MM-DD</code>), and for that shape
        <em>on date</em>, <em>after</em> and <em>before</em> compare on
        <strong class="text-text-primary">UTC day boundaries</strong>: "after 2021-03-15" starts at
        the following midnight UTC, "before 2021-03-15" ends at that day's midnight UTC, and a row
        stamped <code class="text-text-primary">2021-03-15T09:00Z</code> matches neither. A filter
        value that carries a time of day compares instants strictly. Store ISO strings or
        UTC-constructed dates in those columns: a date-only string parses as UTC midnight while a
        date-time string without an offset parses as local time, so a
        <code class="text-text-primary">Date</code> built from local parts (<code
          class="text-text-primary">new Date(2021, 2, 15)</code
        >) can land in the neighbouring UTC day.
      </p>

      <p class="text-text-secondary text-sm">
        To start with filters active, pass
        <code class="text-text-primary"
          >viewDefaults=&#123;&#123; filters: [&hellip;] &#125;&#125;</code
        >, an array of the same
        <code class="text-text-primary">&#123; column, operator, value &#125;</code> objects. That
        is the view's baseline: the chips show them, and users can still remove or add filters. The
        same array is what <code class="text-text-primary">view.filters</code> holds, so assigning to
        it drives filters from your own UI the way the next section drives the search term.
      </p>

      <p class="text-text-secondary text-sm">
        The search field matches a case-insensitive substring, and both it and the filters read the
        column accessor's output rather than what a custom cell renders. With
        <code class="text-text-primary"
          >source=&#123;&#123; processing: 'server', &hellip; &#125;&#125;</code
        >
        the table does not filter locally: the active filters arrive as
        <code class="text-text-primary">filters</code> on the view your backend is given — see
        <a href={resolve('/table/server-processing')} class="text-primary hover:underline"
          >Server Processing</a
        >.
      </p>
    </div>
  </Section>

  <Section id="external-search" title="Search from Outside">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        The search term is one of the six settings of the table's view:
        <code class="text-text-primary">search</code>, <code class="text-text-primary">sort</code>,
        <code class="text-text-primary">filters</code>, <code class="text-text-primary">page</code>,
        <code class="text-text-primary">pageSize</code> and
        <code class="text-text-primary">groupBy</code>. Hand the table a view of your own (<code
          class="text-text-primary">createTableView()</code
        >) and they are yours to write: an effect pushes your field into
        <code class="text-text-primary">view.search</code>, and reading it back is just
        <code class="text-text-primary">view.search</code>, with no callback in between. Your own
        view replaces
        <code class="text-text-primary">viewDefaults</code> rather than joining it (passing both
        throws), so its defaults go to
        <code class="text-text-primary">createTableView(&#123; defaults &#125;)</code>. The table's
        own search field writes the same setting, so the readout below shows what the table is
        filtering by, whichever of the two was typed into last.
      </p>

      <p class="text-text-secondary text-sm">
        One thing comes with writing a field directly: it
        <strong class="text-text-primary">does not reset the page</strong>. The table's own handlers
        do that on a new search, so write
        <code class="text-text-primary">view.page = 1</code> alongside if you want the same behaviour.
        Writing a setting does not subscribe the effect to it, so the effect above runs when your field
        changes and not when the table writes the same setting.
      </p>

      <p class="text-text-secondary text-sm">
        Steering a setting from outside and persisting the view are independent. A setting whose
        value comes from outside is usually one you do not want stored, so name the others instead:
        <code class="text-text-primary"
          >bindViewToStorage(view, &#123; key: 'employees', axes: ['sort', 'filters', 'pageSize',
          'groupBy'] &#125;)</code
        >. It ships with
        <code class="text-text-primary">createTableView</code> in
        <code class="text-text-primary">@urbicon-ui/table</code>; what it stores when and how it
        meets the URL is
        <a href={resolve('/table/url-state')} class="text-primary hover:underline"
          >URL State &amp; Persistence</a
        >.
      </p>

      <CodeExample
        title="External Search Field"
        description="One view, two writers: the input pushes into `view.search`, the table's own search field writes the same setting, and the readout reads it straight back."
        code={codeExternalSearch}
      >
        <div class="w-full space-y-4">
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
          <Table cardsBelow="32rem" items={employees} columns={basicColumns} {view} />
        </div>
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
