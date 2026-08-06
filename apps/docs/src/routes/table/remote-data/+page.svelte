<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import RemoteDataDemo from './RemoteDataDemo.svelte';

  const navigation = [
    { id: 'server-mode', title: 'Server Mode' },
    { id: 'the-query', title: 'The Query' },
    { id: 'managed', title: 'Fetching with source.query' },
    { id: 'manual', title: 'Fetching It Yourself' }
  ];

  const codeQuery = `<Table
  {columns}
  source={{
    query: async (query, { signal }) => {
      const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.itemsPerPage),
        sort: query.sortColumn,
        dir: query.sortDirection,
        q: query.searchTerm
      });
      const res = await fetch(\`/api/users?\${params}\`, { signal });
      const data = await res.json();
      return { items: data.results, totalItems: data.total };
    }
  }}
/>`;

  const codeManual = `${scriptOpen}
  import { Table, createTableView, observeView, viewToQuery } from '@urbicon-ui/table';

  let items = $state([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state(null);

  const view = createTableView({ defaults: { pageSize: 25 } });

  async function load(query) {
    loading = true;
    error = null;
    try {
      const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.itemsPerPage),
        sort: query.sortColumn,
        dir: query.sortDirection,
        q: query.searchTerm
      });
      const res = await fetch(\`/api/users?\${params}\`);
      const data = await res.json();
      items = data.results;
      total = data.total;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }

  // Fires once on registration, then debounced on every view change.
  observeView(view, (snapshot) => load(viewToQuery(snapshot)));
${scriptClose}

<Table {columns} {view} source={{ kind: 'server', items, total, loading, error }} />`;
</script>

<SeoMeta
  title="Remote Data - Table"
  description="Let the backend do the filtering, sorting and paging. The table reports what the reader asked for and renders the rows you return."
/>

<DocsPageLayout
  title="Remote Data (Server Mode)"
  description="Let the backend do the filtering, sorting and paging. The table reports what the reader asked for and renders the rows you return."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="server-mode" title="Server Mode">
    <p class="text-text-secondary mb-6 text-sm">
      A server <code class="text-text-primary">source</code> turns off filtering, sorting and paging inside
      the table. It renders the rows you hand it in the order they arrive.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      Every control writes to one query object. A
      <code class="text-text-primary">source</code> with a
      <code class="text-text-primary">query</code> function lets the table run the fetch itself. The
      manual shape, tagged <code class="text-text-primary">kind: 'server'</code>, leaves the fetch
      to your code: <code class="text-text-primary">observeView</code> reports every view change, the
      source carries the rows back.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      Page numbers come from a total you supply. A managed
      <code class="text-text-primary">query</code> returns it as
      <code class="text-text-primary">totalItems</code>. The manual shape carries it as
      <code class="text-text-primary">total</code>.
    </p>
  </Section>

  <Section id="the-query" title="The Query">
    <p class="text-text-secondary mb-4 text-sm">
      One object carries the seven fields that decide which rows to return. A managed
      <code class="text-text-primary">query</code> receives it;
      <code class="text-text-primary">viewToQuery</code> builds it from a view snapshot in the manual
      flow.
    </p>

    <div class="border-border-hairline mb-6 overflow-x-auto border-y">
      <table class="w-full text-left text-sm">
        <thead class="text-text-primary border-border-hairline border-b">
          <tr>
            <th class="py-2 pr-4 font-semibold">Field</th>
            <th class="py-2 pr-4 font-semibold">Type</th>
            <th class="py-2 font-semibold">Notes</th>
          </tr>
        </thead>
        <tbody class="text-text-secondary divide-border-hairline divide-y">
          <tr>
            <td class="py-2 pr-4"><code>page</code></td>
            <td class="py-2 pr-4"><code>number</code></td>
            <td class="py-2">Starts at 1</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>itemsPerPage</code></td>
            <td class="py-2 pr-4"><code>number</code></td>
            <td class="py-2">Rows per page</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>sortColumn</code></td>
            <td class="py-2 pr-4"><code>string</code></td>
            <td class="py-2">A column id, or <code>''</code> when nothing is sorted</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>sortDirection</code></td>
            <td class="py-2 pr-4"><code>'asc' | 'desc'</code></td>
            <td class="py-2">Always set; only meaningful with a <code>sortColumn</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>searchTerm</code></td>
            <td class="py-2 pr-4"><code>string</code></td>
            <td class="py-2">Untrimmed text from the search box</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>activeFilters</code></td>
            <td class="py-2 pr-4"><code>Filter[]</code></td>
            <td class="py-2"><code>{'{ column, operator, value }'}</code> per filter</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>groupByKey</code></td>
            <td class="py-2 pr-4"><code>string | null</code></td>
            <td class="py-2">A column id, or <code>null</code> when ungrouped</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-text-secondary mb-6 text-sm">
      A request body or GraphQL variables take the object as it stands. A query string needs one
      parameter per field. Handing the whole query to
      <code class="text-text-primary">URLSearchParams</code> turns
      <code class="text-text-primary">activeFilters</code> into
      <code class="text-text-primary">[object Object]</code>, and the server sees a filter it cannot
      read.
    </p>
  </Section>

  <Section id="managed" title="Fetching with source.query">
    <p class="text-text-secondary mb-6 text-sm">
      The table calls <code class="text-text-primary">source.query</code> with the query and an
      <code class="text-text-primary">AbortSignal</code>. Return the rows for that page and the
      number of rows matching the query.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The table sets the loading and error states around every call. The managed shape has no
      <code class="text-text-primary">loading</code> or
      <code class="text-text-primary">error</code> fields to pass — supplying them is a type error.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The demo answers from a mock backend in the same module. The snippet shows the same
      <code class="text-text-primary">query</code> against a real endpoint.
    </p>

    <CodeExample title="Live — every interaction is a request" code={codeQuery}>
      <RemoteDataDemo />
    </CodeExample>

    <NoteList variant="flush" class="mt-8">
      <Note title="Pass the signal to your fetch">
        The table aborts the previous request when a new query arrives. A request that never sees
        the signal runs to completion, and its response is discarded on arrival.
      </Note>
      <Note title="The first request goes out immediately">
        Later ones wait for <code>debounceMs</code>, 300 by default. A click on a column header
        waits as long as a keystroke.
      </Note>
      <Note title="A new query function does not refetch">
        The table refetches when the view changes, never because the
        <code>query</code> function changed identity — a parent re-render handing in a fresh closure fetches
        nothing. When something outside the view decides what to fetch, fetch yourself and hand the rows
        to the manual shape.
      </Note>
    </NoteList>
  </Section>

  <Section id="manual" title="Fetching It Yourself">
    <p class="text-text-secondary mb-6 text-sm">
      <code class="text-text-primary">observeView</code> reports every view change and stops there.
      Your code fetches and sets <code class="text-text-primary">items</code>,
      <code class="text-text-primary">total</code>,
      <code class="text-text-primary">loading</code> and
      <code class="text-text-primary">error</code> on the source.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The <code class="text-text-primary">kind: 'server'</code> tag is mandatory. Server mode turns
      the table's own sorting and filtering off, so it stays a decision you spell out — an object
      with <code class="text-text-primary">items</code> and
      <code class="text-text-primary">total</code> but no tag does not compile.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      Reach for it when the fetch belongs somewhere else: a SvelteKit
      <code class="text-text-primary">load</code> function, a GraphQL client, or a store that already
      holds the data.
    </p>

    <CodeExample title="Manual fetch" code={codeManual} preview={false} />

    <p class="text-text-secondary mt-8 mb-6 text-sm">
      This is where a URL sync attaches. The reader's change writes the address bar, and the address
      drives the <code class="text-text-primary">load</code> function that returns the next page of
      rows.
      <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a> covers
      that half.
    </p>
  </Section>
</DocsPageLayout>
