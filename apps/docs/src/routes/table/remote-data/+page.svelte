<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import RemoteDataDemo from './RemoteDataDemo.svelte';

  const codeOnQueryChange = `${scriptOpen}
  let items = $state([]);
  let total = $state(0);
  let loading = $state(false);

  async function handleQuery(query) {
    loading = true;
    const res = await fetch('/api/users?' + new URLSearchParams(query));
    const data = await res.json();
    items = data.results;
    total = data.total;
    loading = false;
  }
${scriptClose}

<Table
  mode="server"
  {items}
  {columns}
  serverTotalItems={total}
  loading={loading}
  onQueryChange={handleQuery}
/>`;
</script>

<SeoMeta title="Remote Data - Table" />

<DocsPageLayout
  title="Remote Data (Server Mode)"
  description="Delegate filtering, sorting, and pagination to your backend with managed or manual integration."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="remote-data">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Set <code class="text-text-primary">mode="server"</code> to delegate filtering, sorting, and pagination
        to your backend. Two integration paths:
      </p>

      <CodeExample
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
        title="Manual: onQueryChange"
        description="Full control – fetch data yourself and feed items back. Works with SvelteKit load functions, GraphQL, or any async pattern."
        code={codeOnQueryChange}
        preview={false}
      />

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">How it works</h4>
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
        </ul>
      </div>
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
