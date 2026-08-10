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
    { id: 'decision', title: 'Who does the work' },
    { id: 'load', title: 'Rows from a SvelteKit load' },
    { id: 'observe', title: 'Without the URL' },
    { id: 'controls', title: 'What changes for the reader' }
  ];

  const codeShape = `<Table {columns} {view} source={{ processing: 'server', items, total }} />`;

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
  title="Server Processing - Table"
  description="Your backend sorts, filters and pages. You hand the table one page of rows at a time, and every control becomes a request."
/>

<DocsPageLayout
  title="Server Processing"
  description="Your backend sorts, filters and pages. You hand the table one page of rows at a time, and every control becomes a request."
  {navigation}
  showToc={true}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="decision" title="Who does the work">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">processing: 'server'</code> switches the table's own searching,
        filtering, sorting and paging off. Your backend does that work, and the table renders the page
        it is handed:
      </p>

      <CodeExample
        title="A page of rows, and how many there are"
        code={codeShape}
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">total</code> counts every row matching the current view, not the
        ones on this page. The pager divides it by the page size, so it is what decides how far the reader
        can page.
      </p>

      <p class="text-text-secondary text-sm">
        There are two ways to run the fetch. You fetch and hand in each page (from a SvelteKit
        <code class="text-text-primary">load</code>, a store, a cache of your own), which is what
        the rest of this page shows. Or you give the table a
        <code class="text-text-primary">query</code> function and it fetches for you:
        <a class="text-primary hover:underline" href={resolve('/table/query')}>Query Function</a>.
        The tag is the same for both.
      </p>

      <NoteList variant="flush">
        <Note title="The tag is required, on every variant">
          Server processing takes controls away from the reader, so it is never inferred. A source
          that carries <code>items</code> and a <code>total</code> but no tag matches no variant and does
          not compile; from plain JavaScript the table throws and names the tag it wanted.
        </Note>
        <Note title="A few hundred rows need none of this">
          Pass them to <code>items</code> and let the table sort and page them in the browser:
          <a class="text-primary hover:underline" href={resolve('/table/client-processing')}
            >Client Processing</a
          >.
        </Note>
      </NoteList>
    </div>
  </Section>

  <Section id="load" title="Rows from a SvelteKit load">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Put the view in the URL, and every sort, filter and page change becomes a navigation that
        <code class="text-text-primary">load</code> answers with the next page. The first page arrives
        in the HTML the reader receives.
      </p>

      <CodeExample
        title="One round trip per interaction"
        description="Server-side rendering all the way through — no fetch in the browser."
        code={codeLoad}
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">searchParamsToViewSnapshot</code> reads the URL against the
        same defaults you hand <code class="text-text-primary">createTableView</code>. Export those
        defaults from one module, as above, and both halves resolve a missing parameter the same
        way. Which parameters get written, and what else the server can read from them, is on
        <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a>.
      </p>

      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">loading</code> and
        <code class="text-text-primary">error</code>
        are yours here, because the fetch is. The table renders both states; you say when they apply,
        and whatever <code class="text-text-primary">error</code> holds is the message shown under the
        error heading.
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
        Call <code class="text-text-primary">observeView</code> during component initialisation,
        next to <code class="text-text-primary">createTableView</code>; the subscription ends with
        the component, so there is nothing to unsubscribe. The snapshot it hands you is exactly what
        a
        <code class="text-text-primary">query</code> function receives, so the
        <a class="text-primary hover:underline" href={resolve('/table/query') + '#params'}
          >parameter translation</a
        > works unchanged.
      </p>

      <p class="text-text-secondary text-sm">
        This fetches in the browser, the same as a
        <code class="text-text-primary">query</code> function does. What you get for the extra code is
        the fetch itself: a refresh button, a poll, a cache in front of it.
      </p>
    </div>
  </Section>

  <Section id="controls" title="What changes for the reader">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Sorting, filtering, search and paging are requests now. The controls look and behave the
        same way, but each one only changes the query, so a parameter your endpoint ignores is a
        control that quietly does nothing. <code class="text-text-primary">sortable: false</code>
        and
        <code class="text-text-primary">groupable: false</code> on a column remove the affordances you
        cannot serve.
      </p>

      <p class="text-text-secondary text-sm">
        Search is not one of them:
        <code class="text-text-primary">searchable</code> gates the browser's own matcher, which server
        processing has already switched off, and the search term reaches your endpoint either way.
      </p>

      <p class="text-text-secondary text-sm">
        Grouping is the one axis the table does not hand over. It travels as
        <code class="text-text-primary">groupBy</code>, and the table also buckets the rows that
        come back — but only the rows of the current page, since those are the only ones it has. The
        groups are therefore page-local: the pager stays, each page is grouped on its own, and a
        group header counts <em>this page's</em> rows rather than the group's size. Your endpoint
        can make those groups more useful by ordering its result by
        <code class="text-text-primary">groupBy</code>, so a page holds whole groups instead of
        slices of several.
      </p>

      <p class="text-text-secondary text-sm">
        Selection reaches as far as the loaded page. Select-all marks the rows the table holds, and
        <code class="text-text-primary">onSelectionChange</code> reports those. Ids from earlier
        pages stay in <code class="text-text-primary">state.selectedIds</code> on the table context; their
        rows are gone. For an action across the whole result set, send the query instead of the selection.
      </p>
    </div>
  </Section>
</DocsPageLayout>
