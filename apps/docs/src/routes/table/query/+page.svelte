<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    InfoCard,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptClose } from '../_data';
  import QueryDemo from './QueryDemo.svelte';

  // `<script lang="ts">` as an opener is safe inside a template literal (the
  // parser only looks for the closing tag); the closer comes from `_data`.
  const scriptOpenTs = '<' + 'script lang="ts">';

  const navigation = [
    { id: 'overview', title: 'Letting the table fetch' },
    { id: 'demo', title: 'Demo' },
    { id: 'params', title: 'From the view to your parameters' },
    { id: 'limits', title: 'What it will not do' }
  ];

  const codeManaged = `${scriptOpenTs}
  import { Table, type Column, type TableViewSnapshot } from '@urbicon-ui/table';

  const columns: Column[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'team', title: 'Team', sortable: true }
  ];

  async function loadUsers(view: TableViewSnapshot, { signal }: { signal: AbortSignal }) {
    const params = new URLSearchParams({
      page: String(view.page),
      size: String(view.pageSize),
      q: view.search
    });
    const response = await fetch(\`/api/users?\${params}\`, { signal });
    // fetch resolves for a 500; throw to reach the table's error state
    if (!response.ok) throw new Error(\`Users request failed: \${response.status}\`);
    return await response.json(); // { items, total }
  }
${scriptClose}

<Table {columns} source={{ processing: 'server', query: loadUsers }} viewDefaults={{ pageSize: 25 }} />`;

  const codeParams = `import type { TableViewSnapshot } from '@urbicon-ui/table';

function toParams(view: TableViewSnapshot) {
  const params = new URLSearchParams({
    page: String(view.page), // 1-based
    size: String(view.pageSize),
    q: view.search // exactly what was typed, spaces and all
  });

  // sort is null while nothing is sorted — no column, no direction
  if (view.sort) {
    params.set('sort', view.sort.column);
    params.set('dir', view.sort.direction); // 'asc' | 'desc'
  }

  if (view.groupBy) params.set('group', view.groupBy);

  // one filter: { column: 'status', operator: 'equals', value: 'active' }
  for (const filter of view.filters) {
    params.append('filter', \`\${filter.column}:\${filter.operator}:\${filter.value}\`);
  }

  return params;
}`;
</script>

<SeoMeta
  title="Query Function - Table"
  description="Give source a query function and the table calls your backend itself, whenever the reader sorts, filters or pages."
/>

<DocsPageLayout
  title="Query Function"
  description="Give source a query function and the table calls your backend itself, whenever the reader sorts, filters or pages."
  {navigation}
  showToc={true}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview" title="Letting the table fetch">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        A <code class="text-text-primary">query</code> function is the second way to run
        <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
          >server processing</a
        >: instead of fetching each page yourself, you hand the table a function and it calls that
        function whenever the reader changes what they see.
      </p>

      <CodeExample
        title="A table that fetches its own pages"
        description="The table builds its pager from the total the call returns."
        code={codeManaged}
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        While a request is open the table shows its loading state, and a rejected promise puts it
        into the error state with the rejection's
        <code class="text-text-primary">message</code>. You render neither yourself.
      </p>

      <InfoCard title="The rows already arrive some other way?">
        A <code class="text-text-primary">query</code> function fetches in the browser, after
        hydration, so the server's HTML carries the empty state. When the rows come from a SvelteKit
        <code class="text-text-primary">load</code>, a store or a cache of your own, you hand the
        table finished rows instead:
        <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
          >Server Processing</a
        >.
      </InfoCard>
    </div>
  </Section>

  <Section id="demo" title="Demo">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The demo runs against an in-memory list of 56 users, behind a delay you can set.
      </p>

      <QueryDemo />
    </div>
  </Section>

  <Section id="params" title="From the view to your parameters">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">query</code> receives the current view itself, the six
        settings under the names the reader's controls write, plus the
        <code class="text-text-primary">signal</code> for that request. Turn it into whatever your endpoint
        reads:
      </p>

      <CodeExample
        title="Translating the view into your parameters"
        description="All six settings as URL parameters."
        code={codeParams}
        language="typescript"
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">operator</code> is one of
        <code class="text-text-primary">contains</code>,
        <code class="text-text-primary">equals</code>,
        <code class="text-text-primary">startsWith</code>,
        <code class="text-text-primary">endsWith</code>,
        <code class="text-text-primary">greaterThan</code> or
        <code class="text-text-primary">lessThan</code>.
        <code class="text-text-primary">value</code> is always a string;
        <code class="text-text-primary">greaterThan</code> and
        <code class="text-text-primary">lessThan</code> read it as a number first and as a date
        second. The full type is
        <a
          class="text-primary hover:underline"
          href={resolve('/table/table') + '#type-TableViewSnapshot'}>TableViewSnapshot</a
        >.
      </p>

      <p class="text-text-secondary text-sm">
        Return <code class="text-text-primary">{'{ items, total }'}</code>.
        <code class="text-text-primary">items</code> is the page you were asked for, and
        <code class="text-text-primary">total</code> counts every row matching the query. It is the same
        field, under the same name, that a manual server source takes.
      </p>

      <NoteList variant="flush">
        <Note title="One request per burst">
          The first call goes out immediately, every later one after
          <code>debounceMs</code> (300 by default). A fast typist produces one request, not one per keystroke.
        </Note>
        <Note title="Search waits twice">
          A keystroke reaches the view after <code>searchDebounceMs</code> (300) and the network
          after
          <code>debounceMs</code> on top, so search sits about 600 ms behind. The two sit on
          different objects: <code>{'<Table searchDebounceMs={100} />'}</code> and
          <code>{"source={{ processing: 'server', query: loadUsers, debounceMs: 100 }}"}</code>.
        </Note>
        <Note title="Pass the signal on">
          When a newer request supersedes one in flight, the table aborts it. Handing
          <code>signal</code> to <code>fetch</code> is what carries that abort to the network, and an
          aborted request never reaches your error handling.
        </Note>
      </NoteList>
    </div>
  </Section>

  <Section id="limits" title="What it will not do">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The view is the only thing that starts a fetch. Writing a value the view already holds
        changes nothing, so a <code class="text-text-primary">query</code> function cannot ask the server
        the same question twice.
      </p>

      <p class="text-text-secondary text-sm">
        That is the whole remit, deliberately. A refresh button, a poll, a cache, retries, a refetch
        after a mutation: that is a data layer, and yours will do it better than one grown inside a
        table. TanStack Query and SvelteKit's remote functions both already have it. Hand their
        result to the manual flow, which asks only for rows and a total:
        <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
          >Server Processing</a
        >.
      </p>

      <p class="text-text-secondary text-sm">
        Rows changing under the reader are the third case. Push them into the table rather than
        refetching:
        <a class="text-primary hover:underline" href={resolve('/table/live-updates')}
          >Live Updates</a
        >.
      </p>
    </div>
  </Section>
</DocsPageLayout>
