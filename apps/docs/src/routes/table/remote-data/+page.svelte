<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import RemoteDataDemo from './RemoteDataDemo.svelte';

  const codeOnQueryChange = `${scriptOpen}
  let items = $state([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state(null);

  async function handleQuery(query) {
    loading = true;
    error = null;
    try {
      const res = await fetch('/api/users?' + new URLSearchParams(query));
      const data = await res.json();
      items = data.results;
      total = data.total;
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
${scriptClose}

<Table
  mode="server"
  {items}
  {columns}
  serverTotalItems={total}
  {loading}
  {error}
  onQueryChange={handleQuery}
/>`;
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
      Set <code class="text-text-primary">mode="server"</code> to delegate filtering, sorting, and pagination
      to your backend. Two integration paths:
    </p>

    <CodeExample
      headingLevel={2}
      title="Managed: queryFn"
      description="Provide an async function – the table handles loading, errors, request cancellation (AbortSignal), and debouncing automatically. The live demo runs against a deterministic in-memory mock backend that filters, sorts, and paginates 56 rows server-side after an adjustable artificial latency (no real network requests) — the code shows the real fetch-based consumer pattern."
      code={`<Table
  mode="server"
  columns={columns}
  queryFn={async (query, { signal }) => {
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
  }}
  queryDebounceMs={300}
/>`}
    >
      <RemoteDataDemo />
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title="Manual: onQueryChange"
      description="Full control – fetch data yourself and feed items back. Works with SvelteKit load functions, GraphQL, or any async pattern."
      code={codeOnQueryChange}
      preview={false}
    />

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">How it works</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>In server mode, filtering, sorting, and pagination pass items through unchanged</li>
        <li>
          The <code class="text-text-primary">TableQuery</code> object contains
          <code class="text-text-primary">page</code>,
          <code class="text-text-primary">itemsPerPage</code>,
          <code class="text-text-primary">sortColumn</code>,
          <code class="text-text-primary">sortDirection</code>,
          <code class="text-text-primary">searchTerm</code>,
          <code class="text-text-primary">activeFilters</code>,
          <code class="text-text-primary">groupByKey</code>
        </li>
        <li>
          <code class="text-text-primary">queryFn</code> receives an
          <code class="text-text-primary">AbortSignal</code> – cancelled automatically when a new query
          fires
        </li>
        <li>Search is debounced (default 300ms) to avoid excessive requests</li>
        <li>
          With <code class="text-text-primary">queryFn</code> the table owns the
          <code class="text-text-primary">loading</code> and
          <code class="text-text-primary">error</code> states and ignores those props (DEV warns). In
          the manual flow they are yours to set — they drive the same loading/error rows, in client mode
          too.
        </li>
      </ul>
    </div>
  </div>
</DocsPageLayout>
