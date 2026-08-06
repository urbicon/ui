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
  import { scriptClose } from '../_data';

  // `<script lang="ts">` as an opener is safe inside a template literal (the
  // parser only looks for the closing tag); the closer comes from `_data`.
  const scriptOpenTs = '<' + 'script lang="ts">';

  // Display-only specifiers. Interpolated so vite's dep-scanner — which
  // regex-extracts imports from the raw script of a lang="ts" svelte file —
  // does not try to resolve paths that only exist in the reader's project.
  const columnsPath = `'./columns'`;
  const viewPath = `'./view-defaults'`;

  const navigation = [
    { id: 'overview', title: 'Rows that arrive with the page' },
    { id: 'defaults', title: 'One place for the defaults' },
    { id: 'observe', title: 'Without the URL' }
  ];

  const codeLoad = `// view-defaults.ts — one declaration, read by both halves
export const userView = { pageSize: 25 };

// +page.server.ts
import { searchParamsToViewSnapshot } from '@urbicon-ui/sveltekit-utils/table-view';
import { userView } from ${viewPath};

export const load = async ({ url }) => {
  const query = searchParamsToViewSnapshot(url.searchParams, userView);
  return await fetchUsers(query); // { items, total }
};

// +page.svelte
${scriptOpenTs}
  import { Table, createTableView } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { userView } from ${viewPath};
  import { columns } from ${columnsPath};

  let { data } = $props();

  const view = createTableView({ defaults: userView });
  bindViewToUrl(view);
${scriptClose}

<Table {columns} {view} source={{ processing: 'server', items: data.items, total: data.total }} />`;

  const codeObserve = `${scriptOpenTs}
  import { Table, createTableView, observeView } from '@urbicon-ui/table';

  const view = createTableView({ defaults: { pageSize: 25 } });

  let items = $state<User[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);

  observeView(view, async (snapshot) => {
    loading = true;
    try {
      const result = await fetchUsers(snapshot);
      items = result.items;
      total = result.total;
      error = null;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not load users';
    } finally {
      loading = false;
    }
  });
${scriptClose}

<Table {columns} {view} source={{ processing: 'server', items, total, loading, error }} />`;
</script>

<SeoMeta
  title="Server-Rendered Data - Table"
  description="The browser gets the data: you fetch the rows in a SvelteKit load and hand them to the table with processing: 'server', so the first page arrives server-rendered."
/>

<DocsPageLayout
  title="Server-Rendered Data"
  description="The browser gets the data. You fetch the rows, the table renders them, and with a SvelteKit load the first page arrives in the HTML."
  {navigation}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview" title="Rows that arrive with the page">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        When a SvelteKit <code class="text-text-primary">load</code> fetches your rows, they are
        already there while the page renders. Hand the table what you have: the page of rows, the
        total, and <code class="text-text-primary">processing: 'server'</code>. The view lives in
        the URL, so every sort, filter and page change is a navigation, and
        <code class="text-text-primary">load</code> answers it with the next page.
      </p>

      <CodeExample
        title="Rows from a SvelteKit load"
        description="Server-side rendering all the way through: the first page is in the HTML the reader receives."
        code={codeLoad}
        preview={false}
      />

      <NoteList variant="flush">
        <Note title="processing: 'server' is the decision">
          It switches the table's own sorting, filtering, searching and paging off, so it has to be
          an explicit decision. The type rejects the near misses: a <code>total</code> without the
          tag does not compile, and neither does the tag next to a <code>query</code>.
        </Note>
        <Note title="You own loading and error">
          The table renders both states, you say when they apply. Whatever <code>error</code> holds is
          the message the error state shows under its heading.
        </Note>
      </NoteList>

      <p class="text-text-secondary text-sm">
        Server mode also changes what the table's controls can still do for the reader:
        <a
          class="text-primary hover:underline"
          href={resolve('/table/remote-data') + '#server-mode'}>What server mode changes</a
        >. To have the table do the fetching instead, give it a
        <code class="text-text-primary">query</code> function:
        <a class="text-primary hover:underline" href={resolve('/table/remote-data')}>Remote Data</a
        >.
      </p>
    </div>
  </Section>

  <Section id="defaults" title="One place for the defaults">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">searchParamsToViewSnapshot</code> reads the URL against the
        same defaults you hand <code class="text-text-primary">createTableView</code>, and returns
        the very view a <code class="text-text-primary">query</code> function receives. Export those defaults
        from one module and both halves resolve a missing parameter the same way.
      </p>

      <p class="text-text-secondary text-sm">
        Which parameters <code class="text-text-primary">bindViewToUrl</code> writes, and what the
        server can read from them, is on
        <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a>.
      </p>
    </div>
  </Section>

  <Section id="observe" title="Without the URL">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Not every table wants its state in the address bar. Then
        <code class="text-text-primary">observeView</code> is what tells you to fetch. It fires once
        after mount, then debounced after every change (300 ms, or
        <code class="text-text-primary">{'{ debounceMs }'}</code> as a third argument).
      </p>

      <CodeExample
        title="Refetching without the URL"
        description="The table only aborts requests it started, so a superseded response here is yours to drop."
        code={codeObserve}
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        The snapshot is exactly what a <code class="text-text-primary">query</code> function
        receives, so the <code class="text-text-primary">toParams</code> from
        <a class="text-primary hover:underline" href={resolve('/table/remote-data') + '#query'}
          >Remote Data</a
        >
        works unchanged. Call <code class="text-text-primary">observeView</code> during component
        initialisation, next to <code class="text-text-primary">createTableView</code>; the
        subscription ends with the component, so there is nothing to unsubscribe.
      </p>

      <p class="text-text-secondary text-sm">
        This fetches in the browser, the same as a
        <code class="text-text-primary">query</code> function does. What you get for the extra code is
        the fetch itself: a refresh button, a poll, a cache in front of it.
      </p>
    </div>
  </Section>
</DocsPageLayout>
