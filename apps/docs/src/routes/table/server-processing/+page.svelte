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

  const codeShape = `<Table {columns} source={{ processing: 'server', items, total }} />`;

  const codeLoad = `// view-defaults.ts — one declaration, read by both halves
export const userView = { pageSize: 25 };

// +page.server.ts
import { searchParamsToViewSnapshot } from '@urbicon-ui/sveltekit-utils/table-view';
import { userView } from ${viewPath};

export const load = async ({ url }) => {
  // { search, sort, page, pageSize, filters, groupBy }, resolved against userView
  const snapshot = searchParamsToViewSnapshot(url.searchParams, userView);
  return await fetchUsers(snapshot); // { items, total }
};

// +page.svelte
${scriptOpenTs}
  import { Table, createTableView } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';
  import { navigating } from '$app/state';
  import { userView } from ${viewPath};
  import { columns } from ${columnsPath};

  let { data } = $props();

  const view = createTableView({ defaults: userView });
  bindViewToUrl(view);
${scriptClose}

<Table
  {columns}
  {view}
  source={{
    processing: 'server',
    items: data.items,
    total: data.total,
    loading: !!navigating.to
  }}
/>`;

  const codeObserve = `${scriptOpenTs}
  import { Table, createTableView, observeView } from '@urbicon-ui/table';

  const view = createTableView({ defaults: { pageSize: 25 } });

  let items = $state<User[]>([]);
  let total = $state(0);
  let loading = $state(false);
  let error = $state<string | null>(null);
  let latest = 0;

  observeView(view, async (snapshot) => {
    const run = ++latest;
    loading = true;
    try {
      const result = await fetchUsers(snapshot);
      if (run !== latest) return; // a newer view has already asked
      items = result.items;
      total = result.total;
      error = null;
    } catch (e) {
      if (run !== latest) return;
      error = e instanceof Error ? e.message : 'Could not load users';
    } finally {
      if (run === latest) loading = false;
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
        <code class="text-text-primary">total</code> counts every row your endpoint matched for the current
        search and filters, not just the ones on this page. The pager divides it by the page size, so
        it is what decides how far the reader can page.
      </p>

      <p class="text-text-secondary text-sm">
        There are two ways to run the fetch, and the tag is the same for both. A
        <code class="text-text-primary">query</code> function lets the table fetch for you whenever
        the view changes:
        <a class="text-primary hover:underline" href={resolve('/table/query')}>Query Function</a>.
        Fetching yourself and handing in each page (from a SvelteKit
        <code class="text-text-primary">load</code>, a store, a cache of your own) is what the rest
        of this page shows; take it when something other than the view has to trigger a fetch too, a
        refresh button or a poll.
      </p>

      <NoteList variant="flush">
        <Note title="source always carries the tag">
          Server processing takes controls away from the reader, so it is never inferred. A source
          of
          <code>items</code> and a <code>total</code> without the tag is a type error, and from
          plain JavaScript the table throws and names the tag it wanted. The
          <code>items</code> prop needs none: rows on their own mean client processing.
        </Note>
        <Note title="A few thousand rows need none of this">
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
        The snapshot your fetch receives is the view itself, under the names the table uses:
        <code class="text-text-primary">search</code> (a string),
        <code class="text-text-primary">sort</code>
        (<code class="text-text-primary">{'{ column, direction }'}</code>, or
        <code class="text-text-primary">null</code>),
        <code class="text-text-primary">page</code> and
        <code class="text-text-primary">pageSize</code>,
        <code class="text-text-primary">filters</code> (each
        <code class="text-text-primary">{'{ column, operator, value }'}</code>) and
        <code class="text-text-primary">groupBy</code>. Every
        <code class="text-text-primary">column</code> is a column id. Projecting those six onto your
        backend's parameters happens inside your fetch, and
        <a class="text-primary hover:underline" href={resolve('/table/query') + '#params'}
          >parameter translation</a
        > walks through one.
      </p>

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
        are yours here, because the fetch is. On this route the fetch is a navigation, and SvelteKit already
        tracks it:
        <code class="text-text-primary">navigating.to</code> stays set for as long as
        <code class="text-text-primary">load</code> runs. A
        <code class="text-text-primary">load</code> that throws renders your error page instead, so
        <code class="text-text-primary">error</code> carries the failures you catch and return as data,
        and whatever it holds is the message under the table's error heading.
      </p>
    </div>
  </Section>

  <Section id="observe" title="Without the URL">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Not every table wants its state in the address bar. Then
        <code class="text-text-primary">observeView</code> is what tells you to fetch. It fires once
        after mount, then debounced after every change (300 ms, or
        <code class="text-text-primary">{'{ debounceMs }'}</code> as a third argument to
        <code class="text-text-primary">observeView</code>).
      </p>

      <CodeExample
        title="Refetching without the URL"
        description="The table aborts only the requests it started, so the counter here is what drops a superseded response."
        code={codeObserve}
        preview={false}
      />

      <p class="text-text-secondary text-sm">
        Call <code class="text-text-primary">observeView</code> during component initialisation,
        next to <code class="text-text-primary">createTableView</code>; the subscription ends with
        the component, so there is nothing to unsubscribe. The snapshot it hands you is the same
        object the <code class="text-text-primary">load</code> above passes to its fetch, and the
        same one a <code class="text-text-primary">query</code> function receives.
      </p>

      <p class="text-text-secondary text-sm">
        This fetches in the browser, so the first rows arrive after mount rather than in the HTML
        the reader receives.
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
        The search field is the exception: its term travels whatever the columns say.
        <code class="text-text-primary">searchable: false</code> takes a column out of the browser's own
        matcher, which server processing has already switched off, and out of the filter menu, whose filters
        do reach your endpoint. So it stays the flag for a column your endpoint cannot filter on.
      </p>

      <p class="text-text-secondary text-sm">
        Grouping is the one axis the table does not hand over. It travels as
        <code class="text-text-primary">groupBy</code>, and the table buckets the rows that come
        back, which are only the rows of the current page. The groups are therefore page-local: the
        pager stays, each page is grouped on its own, and a group header counts this page's rows and
        says so: its count reads
        <code class="text-text-primary">(3 items on this page)</code>. Your endpoint can make those
        groups more useful by ordering its result by
        <code class="text-text-primary">groupBy</code>, so a page holds whole groups instead of
        slices of several. The order the groups appear in follows the page's rows, so it can differ
        from page to page unless your endpoint imposes one.
      </p>

      <p class="text-text-secondary text-sm">
        Group summary rows aggregate the same page-local rows, so a sum under a group of three is
        the sum of those three, not of the group, and their labels do not say so. If that
        distinction matters to your readers, compute the totals server-side and render them
        yourself. Collapsing follows the group's <em>name</em>, so a group collapsed on one page
        stays collapsed on the next even though its rows are different.
      </p>

      <p class="text-text-secondary text-sm">
        Select-all marks the rows the table holds, which here is the loaded page. The selection
        itself survives paging: a row ticked on page 1 is still ticked when the reader comes back,
        and <code class="text-text-primary">onSelectionChange</code> does not fire on a page change.
        This is why its second argument matters here — the ids are the whole selection, the rows
        only the ones currently loaded, so a
        <a href={resolve('/table/selection') + '#controlled'} class="text-primary hover:underline"
          >controlled selection</a
        > writes the ids back. For an action across the whole result set, send the query instead of the
        selection.
      </p>
    </div>
  </Section>
</DocsPageLayout>
