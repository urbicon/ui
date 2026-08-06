<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { scriptClose, scriptOpen } from '../_data';
  import UrlStateDemo from './UrlStateDemo.svelte';

  const navigation = [
    { id: 'url-sync', title: 'View State in the URL' },
    { id: 'phases', title: 'Defaults, URL, Storage' },
    { id: 'between-visits', title: 'Keeping It Between Visits' },
    { id: 'server', title: 'What the Server Renders' }
  ];

  const codeUrlSync = `${scriptOpen}
  import { createTableView, Table } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const view = createTableView({ defaults: { pageSize: 5 } });
  bindViewToUrl(view, { prefix: 'demo_' });
${scriptClose}

<Table
  {items}
  {columns}
  {view}
  enableSmartFilter
  searchPlaceholder="Search employees…"
/>`;

  const codeStorage = `${scriptOpen}
  import { bindViewToStorage, createTableView, Table } from '@urbicon-ui/table';
  import { bindViewToUrl } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const view = createTableView({ defaults: { pageSize: 25 } });
  bindViewToUrl(view);
  bindViewToStorage(view, { key: 'invoices' });
${scriptClose}

<Table {items} {columns} {view} prefs={{ storage: 'invoices' }} />`;

  const codeServer = `// view-defaults.ts — shared with the component
export const invoiceView = { pageSize: 25 };

// +page.server.ts
import { searchParamsToViewQuery } from '@urbicon-ui/sveltekit-utils/table-view';
import { invoiceView } from './view-defaults';

export const load = async ({ url }) => {
  const query = searchParamsToViewQuery(url.searchParams, invoiceView);
  return { initialResult: await fetchInvoices(query) };
};`;
</script>

<SeoMeta
  title="URL State & Persistence - Table"
  description="Put the table's view state in the URL so it is shareable, survives a reload and is visible to the server — and decide what localStorage keeps between visits."
/>

<DocsPageLayout
  title="URL State & Persistence"
  description="Put the table's view state in the URL so it is shareable, survives a reload and is visible to the server — and decide what localStorage keeps between visits."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="url-sync" title="View State in the URL">
    <p class="text-text-secondary mb-6 text-sm">
      Search, sort, page, page size, filters and grouping are the six axes that decide <em>which</em
      >
      rows a reader is looking at. They live in one object — a view — that you create and the table reads.
      Bind that object to the URL and the view becomes a link: it survives a reload, can be pasted into
      a ticket, and — unlike <code class="text-text-primary">localStorage</code> — the server can read
      it.
    </p>

    <CodeExample
      title="One object, one binding"
      description="`createTableView` holds the axes, `bindViewToUrl` gives them the URL as their home, and the table takes the object. The demo below is that exact wiring running against this page's address bar, with every key namespaced by prefix: 'demo_'."
      code={codeUrlSync}
    >
      <UrlStateDemo />
    </CodeExample>

    <p class="text-text-secondary mt-8 text-sm">
      <code class="text-text-primary">defaults</code> is written once and does two jobs: it is the
      state the table starts in <em>and</em> the baseline the URL elides against. A table sitting in
      its default state therefore writes no params at all, and a reader who clears search and sort
      gets a clean address back. A table that never needs the object itself can skip it —
      <code class="text-text-primary"
        >{'<Table {items} {columns} viewDefaults={{ pageSize: 25 }} />'}</code
      > owns its view.
    </p>
    <p class="text-text-secondary mt-4 text-sm">
      Writes are debounced (300 ms) and replace the current history entry, so a burst of sort clicks
      does not flood the back button — <code class="text-text-primary">replaceState: false</code>
      pushes instead, <code class="text-text-primary">axes</code> binds fewer than all six, and
      <code class="text-text-primary">prefix</code> namespaces the keys for a second bound table on the
      same page.
    </p>
  </Section>

  <Section id="phases" title="Defaults, URL, Storage">
    <p class="text-text-secondary mb-6 text-sm">
      Three things can supply an axis: the defaults you passed, a URL, and — with the storage
      binding from the next section — what the reader left behind last time. One rule covers all of
      it, and it is about <strong class="text-text-primary">phases</strong>, not precedence:
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <p class="text-text-primary text-sm">
        One view object, fully resolved against its defaults. Bindings declare their axes
        statically. Defaults → URL (on arrival) → storage (after hydration); at runtime only the URL
        applies, storage only writes, and an axis is stored when its last change came from the
        reader.
      </p>
    </div>

    <div class="border-border-subtle bg-surface-elevated mt-6 rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">What follows from it</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          <strong class="text-text-primary">A deep link beats storage — once.</strong> An axis the arriving
          URL names is not seeded from storage. That is the one moment a param's presence decides anything;
          afterwards the phases do.
        </li>
        <li>
          <strong class="text-text-primary">The back button restores the default.</strong>
          Navigating to an address without <code class="text-text-primary">?sort</code> returns the table
          to its default sort, not to the stored one — storage applies once, after hydration, and never
          again. The binding keeps reading the URL, which it has to: SvelteKit does not remount a page
          for a query-string change.
        </li>
        <li>
          <strong class="text-text-primary">Someone else's link stores nothing.</strong> What a binding
          applies is not the reader's change, so it is never written back — and neither is a value the
          table itself discards.
        </li>
        <li>
          <strong class="text-text-primary">Empty is a value.</strong> A URL saying
          <code class="text-text-primary">?sort=</code> means "unsorted",
          <code class="text-text-primary">?filter=</code> means "no filters". The markers only
          appear where the default is not empty — otherwise empty <em>is</em> the default and elides —
          so an axis the reader cleared stays cleared across a reload.
        </li>
        <li>
          <strong class="text-text-primary">Grouping keeps its gate.</strong> A
          <code class="text-text-primary">?group=</code> on a
          <code class="text-text-primary">virtualized</code> table is refused on every path, server render
          included — a link must not switch a large table into a mode that renders the full item set.
          The refusal is the table's decision, not the reader's, so it cleans the param while a grouping
          the reader chose earlier survives in storage.
        </li>
        <li>
          <strong class="text-text-primary">Two bindings of one kind on one axis throw.</strong> Two URL
          bindings without distinct prefixes are a programming error, not a precedence question. A URL
          binding and a storage binding on the same axis is the composition this page is about.
        </li>
      </ul>
    </div>
  </Section>

  <Section id="between-visits" title="Keeping It Between Visits">
    <p class="text-text-secondary mb-6 text-sm">
      While the URL carries the state, the URL <em>is</em> the state. What that does not survive is opening
      the page from a bare link — nothing was stored, so the reader starts clean. For a business table
      that is usually the wrong answer, since "my filters are still there tomorrow" is expected. The second
      binding is one more line on the same object.
    </p>

    <CodeExample
      title="Two bindings, one view"
      description="`bindViewToStorage` is kit-free — it lives in @urbicon-ui/table, because web storage is a browser API, not a SvelteKit one. The `prefs` prop is a separate channel for the presentation state that never belongs in a link."
      code={codeStorage}
      preview={false}
    />

    <p class="text-text-secondary mt-6 text-sm">
      Five of the six axes are bound by default: search, sort, page size, filters and grouping.
      <code class="text-text-primary">page</code>
      is deliberately out — page 1 on arrival is standard UX — while
      <code class="text-text-primary">pageSize</code> is in, because "yesterday's page size is still
      set" is squarely what persistence promises. The URL keeps carrying both, so a shared link
      still names its page. Narrow the set with <code class="text-text-primary">axes</code>, or hand
      in
      <code class="text-text-primary">sessionStorage</code> via
      <code class="text-text-primary">storage</code>; see
      <a class="text-primary hover:underline" href={resolve('/table/customization')}
        >Customization</a
      >.
    </p>
    <p class="text-text-secondary mt-4 text-sm">
      Only values the reader chose are written, which is worth knowing when you ship:
      <strong class="text-text-primary">a default nobody touched is never stored</strong>. Change
      <code class="text-text-primary">pageSize</code> from 25 to 50 in a later release and everyone
      who never picked a size gets 50; the readers who did keep theirs. The whole view is one entry
      per
      <code class="text-text-primary">key</code> — pick a stable, unique one per table, since two
      tables sharing a key overwrite each other. A table upgraded from v7 starts from its defaults
      once: the old entry per axis is not read (<code class="text-text-primary">prefs</code> keeps its
      own keys).
    </p>
    <p class="text-text-secondary mt-4 text-sm">
      The binding hands back <code class="text-text-primary">{'{ clear, flush }'}</code>:
      <code class="text-text-primary">clear()</code> is the "reset saved view" button — it empties
      the entry and leaves the live view alone — and
      <code class="text-text-primary">flush()</code> forces a pending write out before a programmatic
      navigation, since the teardown drops one still inside the debounce window rather than letting an
      unmounted table write.
    </p>
    <p class="text-text-secondary mt-4 text-sm">
      Column visibility, column order and summaries are <em>not</em> view axes. They are
      presentation rather than selection, so they travel in
      <code class="text-text-primary">prefs</code>
      and never enter the URL — nobody wants to share a link that hides columns on the other end, and
      the server renders every column.
      <code class="text-text-primary"
        >{"prefs={{ storage: 'invoices', persistSelection: true }}"}</code
      > takes the selection along.
    </p>
  </Section>

  <Section id="server" title="What the Server Renders">
    <p class="text-text-secondary mb-6 text-sm">
      The URL reaches the view <strong class="text-text-primary"
        >synchronously, during initialisation</strong
      >
      — no effect involved. That is the whole reason the binding is shaped this way:
      <code class="text-text-primary">$effect</code> never runs during server rendering, so view
      state ingested in one is absent from the server's HTML, and the server would send an unsorted,
      unfiltered table that the client swaps out on hydration with the reader watching. Applied at
      init, a
      <code class="text-text-primary">?sort=salary&amp;dir=desc</code> link is already sorted in the markup
      that arrives.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      The same argument is why <code class="text-text-primary">localStorage</code> cannot be the only
      home for view state: the server cannot see it, so a persisted sort would produce one row order on
      the server and another after hydration. That is exactly why storage is a post-hydration phase —
      it applies from an effect, the two renders agree, and yesterday's view arrives a moment later. The
      URL is visible to both sides.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      The demo above cannot show you this half, and it is worth saying why: this docs site is
      <em>prerendered</em>
      — one HTML file per route, built before any query string exists. SvelteKit forbids reading
      <code class="text-text-primary">url.searchParams</code> there, so the binding skips its init
      read while <code class="text-text-primary">building</code> and the client applies the real URL
      at init instead. In an app that renders per request (a SvelteKit
      <code class="text-text-primary">load</code> without
      <code class="text-text-primary">prerender</code>, or the server source below) the very same
      wiring puts the sorted, filtered view into the first response.
    </p>

    <CodeExample
      title="Seeding the first fetch"
      description="The same params answer the load function. `searchParamsToViewQuery` resolves them against the very defaults object the component hands createTableView, and returns the query a fetch needs — so an absent param resolves on the server exactly as it does in the view, from one declaration rather than two."
      code={codeServer}
      preview={false}
    />

    <p class="text-text-secondary mt-6 text-sm">
      The serializers live in <code class="text-text-primary"
        >@urbicon-ui/sveltekit-utils/table-view</code
      >
      and work without SvelteKit;
      <code class="text-text-primary">bindViewToUrl</code> in
      <code class="text-text-primary">/url.svelte</code> is the reactive half that needs it. See
      <a class="text-primary hover:underline" href={resolve('/table/remote-data')}>Remote Data</a> for
      the fetch side.
    </p>
  </Section>
</DocsPageLayout>
