<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import RemoteDataDemo from './RemoteDataDemo.svelte';

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
  description="Delegate filtering, sorting, and pagination to your backend with managed or manual integration."
/>

<DocsPageLayout
  title="Remote Data (Server Mode)"
  description="Delegate filtering, sorting, and pagination to your backend with managed or manual integration."
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
      One <code class="text-text-primary">source</code> prop says where the rows come from. Two of its
      shapes hand filtering, sorting, and pagination to your backend — one where the table drives the
      fetch, one where you do:
    </p>

    <CodeExample
      headingLevel={2}
      title={'Managed: source={{ query }}'}
      description="Provide an async query function – the table owns loading and error state, aborts superseded requests (AbortSignal), and debounces refetches. The live demo runs against a deterministic in-memory mock backend that filters, sorts, and paginates 56 rows server-side after an adjustable artificial latency (no real network requests) — the code shows the real fetch-based consumer pattern."
      code={`<Table
  {columns}
  source={{
    query: async (query, { signal }) => {
      const params = new URLSearchParams({
        page: String(query.page),
        limit: String(query.itemsPerPage),
        sort: query.sortColumn || '',
        dir: query.sortDirection,
        q: query.searchTerm
      });
      const res = await fetch(\`/api/users?\${params}\`, { signal });
      const data = await res.json();
      return { items: data.results, totalItems: data.total };
    },
    debounceMs: 300
  }}
/>`}
    >
      <RemoteDataDemo />
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title={"Manual: source={{ kind: 'server', … }}"}
      description={"Full control – you fetch, the table renders. observeView is the trigger: it turns every view change into a TableQuery, debounced. Works with SvelteKit load functions, GraphQL, or any async pattern. The kind: 'server' tag is mandatory — { items, total } without it does not compile."}
      code={codeManual}
      preview={false}
    />

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">How it works</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          In server mode the table passes the rows through unchanged – it sorts, filters, and pages
          nothing locally, because the server already did
        </li>
        <li>
          The <code class="text-text-primary">TableQuery</code> object – what the managed
          <code class="text-text-primary">query</code> receives and what
          <code class="text-text-primary">viewToQuery</code> produces – contains
          <code class="text-text-primary">page</code>,
          <code class="text-text-primary">itemsPerPage</code>,
          <code class="text-text-primary">sortColumn</code>,
          <code class="text-text-primary">sortDirection</code>,
          <code class="text-text-primary">searchTerm</code>,
          <code class="text-text-primary">activeFilters</code>,
          <code class="text-text-primary">groupByKey</code>
        </li>
        <li>
          The managed <code class="text-text-primary">query</code> receives an
          <code class="text-text-primary">AbortSignal</code> – cancelled automatically when a new
          query supersedes it. The first fetch runs immediately, later ones are debounced (<code
            class="text-text-primary">debounceMs</code
          >, default 300ms), so typing costs one request, not one per keystroke
        </li>
        <li>
          <code class="text-text-primary">kind: 'server'</code> is mandatory on the manual shape,
          and that is the point: server mode leaves sorting and filtering to the server, so it is a
          decision you make, never one inferred from a
          <code class="text-text-primary">total</code> you happened to pass along.
          <code class="text-text-primary">{'{ items, total }'}</code> without the tag does not compile
        </li>
        <li>
          The managed shape carries the rows, the total, and the loading/error state itself – there
          are no such fields to pass. In the manual shape they are yours to set (<code
            class="text-text-primary">loading</code
          >,
          <code class="text-text-primary">error</code>), and they drive the same loading and error
          rows that <code class="text-text-primary">{'{ items, loading, error }'}</code> drives in client
          mode
        </li>
        <li>
          <code class="text-text-primary">observeView</code> fires once on registration, then
          debounced (default 300ms) on every view change – the same view object
          <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a> puts
          in the address bar
        </li>
      </ul>
    </div>
  </div>
</DocsPageLayout>
