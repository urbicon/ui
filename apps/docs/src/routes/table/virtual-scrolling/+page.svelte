<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Note, NoteList } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, type Employee } from '../_data';

  // 10,000 rows, cycled from the shared fixture: the page claims a row count
  // the DOM never sees, and a preview is the only place a reader can check
  // that. The row number is a column of its own so scrolling shows progress;
  // without it the repeating names read as a table that is not moving.
  const largeDataset: Employee[] = Array.from({ length: 10000 }, (_, index) => ({
    ...employees[index % employees.length],
    id: index + 1
  }));

  // Every column carries a `width`. The virtualized layout renders header and
  // body as separate `<table>` elements, and only an explicit width reaches
  // both: without one the header distributes its columns evenly while the body
  // sizes them to content, and the two grids stop lining up (measured
  // 2026-08-13, header 160px per column against body 29/112/115/79).
  const virtualColumns: Column<Employee>[] = [
    { accessor: 'id', title: '#', dataType: 'number', width: '4rem' },
    { accessor: 'name', title: 'Name', sortable: true, searchable: true, width: '13rem' },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true, width: '13rem' },
    { accessor: 'department', title: 'Department', sortable: true, width: '11rem' },
    { accessor: 'location', title: 'Location', sortable: true, width: '9rem' }
  ];
</script>

<SeoMeta
  title="Virtual Scrolling - Table"
  description="Render only visible rows for large datasets with a lightweight zero-dependency virtualizer."
/>

<DocsPageLayout
  title="Virtual Scrolling"
  description="Render only visible rows for large datasets with a lightweight zero-dependency virtualizer."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <!-- No <Section> wrapper: this page has one unnamed topic, so there is
       nothing to name, no table of contents to feed and no anchor pointing
       here. A Section that renders no heading is a `<div class="relative">`
       plus an unnamed landmark. The pages in this group with more than one
       topic (filtering, selection, sorting-grouping, column-config,
       live-updates, sticky-pinning) do carry titled sections and a nav.

       `headingLevel={2}` on the examples below is load-bearing, not a
       leftover: with no section heading on the page they are the only h2,
       and dropping them to the default h3 puts an h1 -> h3 skip on the
       page (measured, 2026-08). -->
  <div class="space-y-8">
    <p class="text-text-secondary text-sm">
      <code class="text-text-primary">virtualized</code> renders only the rows in view, plus five above
      and five below. A 400&nbsp;px viewport holds about seven rows at the default row height of 56&nbsp;px,
      so the table keeps under twenty in the DOM whether the set has a thousand rows or a hundred thousand.
      Reach for it once the browser is doing more drawing than the reader can see.
    </p>

    <CodeExample
      headingLevel={2}
      title="10,000 Rows"
      description="Scroll the container, sort a column, search: the row count never reaches the DOM."
      code={`<Table
  items={largeDataset}
  {columns}
  virtualized
  virtualHeight="400px"
/>`}
    >
      <Table
        cardsBelow="32rem"
        items={largeDataset}
        columns={virtualColumns}
        virtualized
        virtualHeight="400px"
      />
    </CodeExample>

    <p class="text-text-secondary text-sm">
      Every row is in one scrollable container, so there are no pages to turn: the pager is gone
      while <code class="text-text-primary">virtualized</code> is set. Sorting, filtering, search,
      selection and keyboard navigation work as they do anywhere else, because what gets virtualized
      is your filtered and sorted data.
      <code class="text-text-primary">virtualHeight</code> bounds that container (default
      <code class="text-text-primary">'600px'</code>) and takes any CSS length, so
      <code class="text-text-primary">'60vh'</code> and
      <code class="text-text-primary">'calc(100vh - 200px)'</code> work as well as a pixel value.
    </p>

    <NoteList variant="flush">
      <Note title="Grouping is switched off, not just hidden">
        Grouped virtualization is not implemented, and a grouping that slipped through would put
        every row back in the DOM. So the table drops it whichever way it arrives (view defaults,
        URL, storage), hides the grouping affordances and warns in dev. The URL is cleaned and
        storage is left alone, so a grouping the reader chose earlier applies again on a page
        without <code>virtualized</code>. Either
        <a href={resolve('/table/server-processing')} class="text-primary hover:underline"
          >group on the server</a
        >, or drop <code>virtualized</code>.
      </Note>
      <Note title="Row heights are fixed">
        The virtualizer computes positions from one height per
        <code>size</code> (48, 56 and 64&nbsp;px for sm, md and lg), so a row that grows (wrapping text,
        expanded content) lands in the wrong place. Those rows need the unvirtualized table.
      </Note>
    </NoteList>
  </div>
</DocsPageLayout>
