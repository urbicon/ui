<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { scriptClose, scriptOpen } from '../_data';
  import UrlStateDemo from './UrlStateDemo.svelte';

  const navigation = [
    { id: 'url-sync', title: 'View State in the URL' },
    { id: 'precedence', title: 'URL, Storage, Seed' },
    { id: 'between-visits', title: 'Keeping It Between Visits' },
    { id: 'server', title: 'What the Server Renders' }
  ];

  const codeUrlSync = `${scriptOpen}
  import { Table } from '@urbicon-ui/table';
  import { createTableQueryUrlSync } from '@urbicon-ui/sveltekit-utils/url.svelte';

  const sync = createTableQueryUrlSync({ defaults: { itemsPerPage: 25 } });
${scriptClose}

<Table
  {items}
  {columns}
  itemsPerPage={25}
  query={sync.viewState}
  onQueryChange={sync.syncQuery}
/>`;

  const codePersistControlled = `<!-- The link wins while it carries state; localStorage fills the rest -->
<Table
  {items}
  {columns}
  query={sync.viewState}
  onQueryChange={sync.syncQuery}
  persistenceConfig={{ tableId: 'invoices', persistControlled: true }}
/>`;

  const codeServer = `// +page.server.ts
import { searchParamsToTableQuery } from '@urbicon-ui/sveltekit-utils/table-query';

export const load = async ({ url }) => {
  const query = searchParamsToTableQuery(url.searchParams, {
    defaults: { itemsPerPage: 25 }
  });
  return { initialResult: await fetchInvoices(query) };
};`;
</script>

<SeoMeta
  title="URL State & Persistence - Table"
  description="Put the table's view state in the URL so it is shareable, survives a reload and is visible to the server — and decide what localStorage keeps on top of it."
/>

<DocsPageLayout
  title="URL State & Persistence"
  description="Put the table's view state in the URL so it is shareable, survives a reload and is visible to the server — and decide what localStorage keeps on top of it."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="url-sync" title="View State in the URL">
    <p class="text-text-secondary mb-6 text-sm">
      Search, sort, page, page size, filters and grouping are the axes that decide <em>which</em>
      rows a reader is looking at. Mirror them onto query params and that view becomes a link: it survives
      a reload, can be pasted into a ticket, and — unlike
      <code class="text-text-primary">localStorage</code> — the server can read it. The wiring is two
      props.
    </p>

    <CodeExample
      title="Two props, both directions"
      description="`query` reads the URL (a controlled prop, per axis), `onQueryChange` writes it back. The demo below is the real thing running against this page's address bar, with every key namespaced by prefix: 'demo_'."
      code={codeUrlSync}
    >
      <UrlStateDemo />
    </CodeExample>

    <div class="border-border-subtle bg-surface-elevated mt-8 rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">Two details worth knowing</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          <strong class="text-text-primary"
            >Pass <code>viewState</code>, never
            <code>initialQuery</code>.</strong
          >
          Both come from the same sync.
          <code class="text-text-primary">viewState</code> carries only the axes the URL actually
          names, so an absent one keeps whatever persistence or a seed supplied.
          <code class="text-text-primary">initialQuery</code> describes
          <em>every</em>
          axis — including the ones it filled in from the defaults — so a table wired to it ignores
          <code class="text-text-primary">persistenceConfig</code>,
          <code class="text-text-primary">initialSort</code>,
          <code class="text-text-primary">initialFilters</code> and
          <code class="text-text-primary">initialGroupBy</code> on every URL. DEV warns about both halves,
          but the page still renders the wrong view. It is a snapshot to seed a fetch with, which is what
          the server example below uses it for.
        </li>
        <li>
          <strong class="text-text-primary">Values equal to the defaults are not written.</strong>
          Set <code class="text-text-primary">defaults</code> to the table's own initial props (
          <code class="text-text-primary">itemsPerPage</code>,
          <code class="text-text-primary">initialPage</code>,
          <code class="text-text-primary">initialGroupBy</code>, plus
          <code class="text-text-primary">sortColumn</code>/<code class="text-text-primary"
            >sortDirection</code
          >
          for a baked-in <code class="text-text-primary">initialSort</code>) so the baseline matches
          the state the table starts in — otherwise its opening view writes params describing
          itself.
        </li>
      </ul>
    </div>
  </Section>

  <Section id="precedence" title="URL, Storage, Seed">
    <p class="text-text-secondary mb-6 text-sm">
      Three layers can supply the same axis. They are resolved <strong class="text-text-primary"
        >per axis, in this order</strong
      >:
    </p>

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <ol class="text-text-secondary list-inside list-decimal space-y-3 text-sm">
        <li>
          <strong class="text-text-primary">The <code>query</code> prop</strong> — a field that is present
          controls its axis. This is a derivation, not a write, which is why it also resolves during server
          rendering.
        </li>
        <li>
          <strong class="text-text-primary"
            ><code>persistenceConfig</code> (<code>localStorage</code>)</strong
          > — restores the axes the query says nothing about.
        </li>
        <li>
          <strong class="text-text-primary">The <code>initial*</code> seeds</strong> —
          <code class="text-text-primary">initialSort</code>,
          <code class="text-text-primary">initialFilters</code>,
          <code class="text-text-primary">initialGroupBy</code>,
          <code class="text-text-primary">initialSummaryConfigs</code>,
          <code class="text-text-primary">initialSelectedIds</code>. They fill only what neither of
          the two above supplied.
        </li>
      </ol>
    </div>

    <div class="border-border-subtle bg-surface-elevated mt-6 rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">Consequences</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          <strong class="text-text-primary"
            >Empty is a value — for every axis that can carry a default.</strong
          >
          A URL with <code class="text-text-primary">?sort=</code> says "no sort", and no seed slips
          past it; storage has always worked the same way, an axis the reader cleared restores
          cleared.
          <code class="text-text-primary">activeFilters</code> is the exception:
          <code class="text-text-primary">defaults</code> has no field for it, so an emptied filter
          set writes no marker and an <code class="text-text-primary">initialFilters</code> seed returns
          on the next load.
        </li>
        <li>
          <strong class="text-text-primary">Column visibility and column order are not axes.</strong
          >
          They are presentation, not selection, so they stay in
          <code class="text-text-primary">localStorage</code> and never enter the URL — nobody wants to
          share a link that hides columns on the other end. The server renders every column.
        </li>
        <li>
          <strong class="text-text-primary">Grouping keeps its gate.</strong> A
          <code class="text-text-primary">groupByKey</code> from the URL is refused on a
          <code class="text-text-primary">virtualized</code> table, exactly like every other route into
          grouping — a link must not be able to switch a large table into a mode that renders the full
          item set.
        </li>
        <li>
          <strong class="text-text-primary">The back button works.</strong>
          <code class="text-text-primary">viewState</code> re-reads the URL rather than capturing it
          once, so navigating back to an address without
          <code class="text-text-primary">?sort</code> returns the table to its unsorted view. SvelteKit
          does not remount a page for a query-string change, so a captured value never could.
        </li>
      </ul>
    </div>
  </Section>

  <Section id="between-visits" title="Keeping It Between Visits">
    <p class="text-text-secondary mb-6 text-sm">
      Reading and writing are gated differently, and the asymmetry is deliberate. Restoring is per
      axis: storage fills the axes the query says nothing about. Writing is per table: as soon as a
      <code class="text-text-primary">query</code> prop is wired at all — even one that currently
      names no axis — none of the shareable axes (sort, search, filters, grouping) go to storage.
      The reason is a race: a setter runs synchronously while the URL only catches up after a
      debounce and an async <code class="text-text-primary">goto</code>, so a per-axis write gate
      would store the first sort and drop the ones after it.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      While the URL carries the state, the URL <em>is</em> the state. What that does not survive is opening
      the page from a bare link — nothing was stored, so the reader starts clean. For a business table
      that is usually the wrong answer, since "my filters are still there tomorrow" is expected.
    </p>

    <CodeExample
      title="persistControlled"
      description="Stores the controlled axes as well, and hands them back on a visit without params. Writes happen on the reader's own edits only — never when a controlled value resolves — so following someone else's link stores nothing. The reading order is unchanged: a URL that names an axis still wins over the stored value."
      code={codePersistControlled}
      preview={false}
    />

    <p class="text-text-secondary mt-6 text-sm">
      Pick a stable, unique <code class="text-text-primary">tableId</code> per table — two tables
      sharing one id overwrite each other. Pagination is never persisted (page 1 on navigation is
      standard UX), though the URL does carry it. See
      <a class="text-primary hover:underline" href={resolve('/table/customization')}
        >Customization</a
      >
      for the per-axis opt-outs and <code class="text-text-primary">sessionStorage</code>.
    </p>
  </Section>

  <Section id="server" title="What the Server Renders">
    <p class="text-text-secondary mb-6 text-sm">
      This is the reason the axes are controlled props rather than state written on startup.
      <code class="text-text-primary">$effect</code> never runs during server rendering, so any view
      state ingested in one is absent from the prerendered HTML — the server would send an unsorted,
      unfiltered table that the client swaps out on hydration, with the reader watching. A
      <code class="text-text-primary">$derived</code> is evaluated on the server, so the linked view is
      in the markup that arrives.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      The same argument is why <code class="text-text-primary">localStorage</code> cannot be the only
      home for view state: the server cannot see it, so a persisted sort produces one row order on the
      server and another after hydration. The URL is visible to both.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      The demo above cannot show you this half, and it is worth saying why: this docs site is
      <em>prerendered</em>
      — one HTML file per route, built before any query string exists — so its server render is the default
      view by definition, and the demo does its work after hydration. In an app that renders per request
      (a SvelteKit
      <code class="text-text-primary">load</code> without
      <code class="text-text-primary">prerender</code>, or server mode below) the very same wiring
      puts the sorted, filtered view into the first response. The
      <code class="text-text-primary">building</code> guard that makes the demo prerender-safe is in its
      source, six lines from the top.
    </p>

    <CodeExample
      title="Seeding the first fetch"
      description="In server mode the same params answer the load function. `searchParamsToTableQuery` is a pure serializer — no SvelteKit import — and returns a complete query, which is exactly what a fetch needs. Give the table its `query` prop from the same sync alongside, so its own controls stay in step with the link."
      code={codeServer}
      preview={false}
    />

    <p class="text-text-secondary mt-6 text-sm">
      The serializers live in <code class="text-text-primary"
        >@urbicon-ui/sveltekit-utils/table-query</code
      >
      and work without SvelteKit;
      <code class="text-text-primary">createTableQueryUrlSync</code> in
      <code class="text-text-primary">/url.svelte</code> is the reactive half that needs it. See
      <a class="text-primary hover:underline" href={resolve('/table/remote-data')}>Remote Data</a> for
      the fetch side.
    </p>
  </Section>
</DocsPageLayout>
