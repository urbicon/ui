<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { resolve } from '$app/paths';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { scriptClose, scriptOpen } from '../_data';
  import UrlStateDemo from './UrlStateDemo.svelte';

  const navigation = [
    { id: 'url-sync', title: 'View State in the URL' },
    { id: 'two-props', title: 'The Two Props' },
    { id: 'precedence', title: 'Order of Precedence' },
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

  const codePersistControlled = `<!-- The URL wins while it carries state; localStorage fills the rest -->
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
  description="Write the table's view state to the URL, so a view can be reloaded, shared as a link and read by the server. Plus what localStorage keeps on top of it."
/>

<DocsPageLayout
  title="URL State & Persistence"
  description="Write the table's view state to the URL, so a view can be reloaded, shared as a link and read by the server. Plus what localStorage keeps on top of it."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="url-sync" title="View State in the URL">
    <p class="text-text-secondary mb-4 text-sm">
      Six settings decide <em>which</em> rows someone sees:
    </p>

    <ul class="text-text-secondary mb-6 list-outside list-disc space-y-1 pl-5 text-sm">
      <li>search</li>
      <li>sort</li>
      <li>page</li>
      <li>page size</li>
      <li>filters</li>
      <li>grouping</li>
    </ul>

    <p class="text-text-secondary mb-6 text-sm">
      These settings can be written to the URL as query parameters. Reloading the page then restores
      the view, and the address can be sent to someone else, who opens the same view.
    </p>
  </Section>

  <Section id="two-props" title="The Two Props">
    <p class="text-text-secondary mb-6 text-sm">
      Two props keep the six settings in step with the address bar. Both come from one call to
      <code class="text-text-primary">createTableQueryUrlSync</code>.
    </p>

    <h3 class="text-text-primary mb-2 text-sm font-semibold">query</h3>
    <p class="text-text-secondary mb-4 text-sm">
      Reads the URL and hands the table the settings it names. It re-reads on every navigation, so
      going back to an address without <code class="text-text-primary">?sort</code> returns the table
      to its unsorted view.
    </p>
    <p class="text-text-secondary mb-4 text-sm">
      Presence is the switch. A field that is present takes control of its setting. A field left
      <code class="text-text-primary">undefined</code> changes nothing, and that setting keeps
      whatever
      <code class="text-text-primary">localStorage</code> or an
      <code class="text-text-primary">initial*</code> seed supplied.
    </p>
    <p class="text-text-secondary mb-4 text-sm">
      So pass only the settings you mean to control. An object with every field filled in claims
      every setting, on every URL, including one without parameters.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      The prop fetches nothing. In client mode the table applies the settings to the rows it already
      has; in server mode fetching the matching rows is the job of your load function.
    </p>

    <h3 class="text-text-primary mb-2 text-sm font-semibold">onQueryChange</h3>
    <p class="text-text-secondary mb-6 text-sm">
      Writes changes back to the URL. It runs when someone sorts a column, types in the search box
      or turns a page.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The demo below runs against this page's own address bar. Every key carries the
      <code class="text-text-primary">demo_</code> prefix — the
      <code class="text-text-primary">prefix</code> option, which keeps one table's parameters apart from
      anything else on the page.
    </p>

    <CodeExample title="Live — the table and the address bar" code={codeUrlSync}>
      <UrlStateDemo />
    </CodeExample>

    <NoteList variant="flush" class="mt-8">
      <Note>
        {#snippet titleSnippet()}
          Pass <code>viewState</code>, never <code>initialQuery</code>
        {/snippet}
        Both come from the same sync. <code>viewState</code> carries the settings the URL names.
        <code>initialQuery</code> carries all six, filled in from the defaults, so it claims every
        setting by the rule above — storage and the seeds are ignored on every URL. It is also a
        snapshot that never re-reads the URL, so the back button stops changing the view. Use
        <code>initialQuery</code> to seed a fetch, as the server example below does.
      </Note>
      <Note title="Set the defaults to what the table starts with">
        Values equal to the defaults are not written to the URL, so
        <code>defaults</code> has to match the table's own initial props:
        <code>itemsPerPage</code>, <code>page</code> for <code>initialPage</code>,
        <code>groupByKey</code> for <code>initialGroupBy</code>, and
        <code>sortColumn</code>/<code>sortDirection</code> for a baked-in
        <code>initialSort</code>. If they differ, the table writes parameters for its own opening
        view.
      </Note>
    </NoteList>
  </Section>

  <Section id="precedence" title="Order of Precedence">
    <p class="text-text-secondary mb-6 text-sm">
      Three layers can set the same setting. Every setting is resolved on its own, in this order:
    </p>

    <ol class="text-text-secondary mb-6 list-outside list-decimal space-y-3 pl-5 text-sm">
      <li>
        <strong class="text-text-primary">The <code>query</code> prop.</strong> A field that is present
        controls its setting. This is a derivation rather than a write, so it also resolves while the
        server renders.
      </li>
      <li>
        <strong class="text-text-primary"
          ><code>persistenceConfig</code> (<code>localStorage</code>).</strong
        > Fills the settings the query leaves out.
      </li>
      <li>
        <strong class="text-text-primary">The <code>initial*</code> seeds.</strong> Fill the settings
        neither of the two above supplied.
      </li>
    </ol>

    <p class="text-text-secondary mb-4 text-sm">
      Which layer can set which setting, and under which name:
    </p>

    <div class="border-border-hairline mb-6 overflow-x-auto border-y">
      <table class="w-full text-left text-sm">
        <thead class="text-text-primary border-border-hairline border-b">
          <tr>
            <th class="py-2 pr-4 font-semibold">Setting</th>
            <th class="py-2 pr-4 font-semibold">As a query field</th>
            <th class="py-2 pr-4 font-semibold">In storage</th>
            <th class="py-2 font-semibold">As a seed</th>
          </tr>
        </thead>
        <tbody class="text-text-secondary divide-border-hairline divide-y">
          <tr>
            <td class="py-2 pr-4">search</td>
            <td class="py-2 pr-4"><code>searchTerm</code></td>
            <td class="py-2 pr-4">yes</td>
            <td class="py-2">—</td>
          </tr>
          <tr>
            <td class="py-2 pr-4">sort</td>
            <td class="py-2 pr-4"><code>sortColumn</code> + <code>sortDirection</code></td>
            <td class="py-2 pr-4">yes</td>
            <td class="py-2"><code>initialSort</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4">page</td>
            <td class="py-2 pr-4"><code>page</code></td>
            <td class="py-2 pr-4">never</td>
            <td class="py-2"><code>initialPage</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4">page size</td>
            <td class="py-2 pr-4"><code>itemsPerPage</code></td>
            <td class="py-2 pr-4">never</td>
            <td class="py-2"><code>itemsPerPage</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4">filters</td>
            <td class="py-2 pr-4"><code>activeFilters</code></td>
            <td class="py-2 pr-4">yes</td>
            <td class="py-2"><code>initialFilters</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4">grouping</td>
            <td class="py-2 pr-4"><code>groupByKey</code></td>
            <td class="py-2 pr-4">yes</td>
            <td class="py-2"><code>initialGroupBy</code></td>
          </tr>
          <tr>
            <td class="py-2 pr-4">column visibility, column order</td>
            <td class="py-2 pr-4">never</td>
            <td class="py-2 pr-4">yes</td>
            <td class="py-2">—</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-text-secondary mb-6 text-sm">
      A virtualized table refuses grouping, from the URL like from every other route — a link must
      not switch a large table into a mode that renders every item. DEV warns when it drops one.
    </p>

    <NoteList variant="flush">
      <Note title="Column visibility and column order stay in localStorage">
        They are display settings and never enter the URL, so a shared link shows every column the
        recipient normally sees. The server renders every column.
      </Note>
      <Note title="An empty value is a value">
        A URL with <code>?sort=</code> means "no sort", and no seed overrides it. Storage behaves
        the same way, and a setting someone cleared is restored as cleared. Filters are the
        exception, in the URL only:
        <code>defaults</code> has no field for <code>activeFilters</code>, so an emptied filter set
        writes no marker and an <code>initialFilters</code> seed returns on the next load.
      </Note>
    </NoteList>
  </Section>

  <Section id="between-visits" title="Keeping It Between Visits">
    <p class="text-text-secondary mb-4 text-sm">Reading and writing are gated differently.</p>

    <p class="text-text-secondary mb-4 text-sm">
      <strong class="text-text-primary">Reading is per setting.</strong> Storage fills the settings the
      URL leaves out.
    </p>

    <p class="text-text-secondary mb-4 text-sm">
      <strong class="text-text-primary">Writing is per table.</strong> As soon as a
      <code class="text-text-primary">query</code> prop is wired, the shareable settings (sort, search,
      filters, grouping) are no longer written to storage. This holds even for a query that currently
      names no setting.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      Someone opening the page from a bare link starts with the default view, because nothing was
      stored. Business tables usually want the opposite, since people expect yesterday's filters to
      still be there.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      <code class="text-text-primary">persistControlled</code> stores the controlled settings as well
      and restores them on a visit without parameters. Storage is written on the reader's own edits, not
      when a controlled value resolves, so following someone else's link stores nothing. A URL that names
      a setting still wins over the stored value.
    </p>

    <CodeExample title="persistControlled" code={codePersistControlled} preview={false} />

    <p class="text-text-secondary mt-6 text-sm">
      Give every table a stable, unique <code class="text-text-primary">tableId</code>, since two
      tables sharing one id overwrite each other. Pagination is never persisted — neither the page
      nor the page size — though the URL carries both.
      <a class="text-primary hover:underline" href={resolve('/table/customization')}
        >Customization</a
      >
      covers the per-setting opt-outs and <code class="text-text-primary">sessionStorage</code>.
    </p>
  </Section>

  <Section id="server" title="What the Server Renders">
    <p class="text-text-secondary mb-6 text-sm">
      The table reads <code class="text-text-primary">query</code> as a
      <code class="text-text-primary">$derived</code>, which runs while the server renders — the
      linked view is already in the markup that arrives. An
      <code class="text-text-primary">$effect</code> does not run there: view state applied through one
      is missing from the server's HTML, and the client replaces the table on hydration.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The same applies to <code class="text-text-primary">localStorage</code> as a home for view state.
      The server cannot read it, so a persisted sort produces one row order on the server and another
      after hydration.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      These docs are prerendered, with one HTML file per route, built before any query string
      exists. Their server render is the default view, and the demo above does its work after
      hydration. An app that renders per request puts the linked view into the first response with
      the same wiring.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      In server mode the load function reads the same parameters.
      <code class="text-text-primary">searchParamsToTableQuery</code> has no SvelteKit import and
      returns a complete query, the shape a fetch wants. The table still gets its
      <code class="text-text-primary">query</code> prop from
      <code class="text-text-primary">createTableQueryUrlSync</code>, with the same
      <code class="text-text-primary">defaults</code>, so its controls stay in step with the link.
    </p>

    <CodeExample title="Seeding the first fetch" code={codeServer} preview={false} />

    <p class="text-text-secondary mt-6 text-sm">
      The serializers live in <code class="text-text-primary"
        >@urbicon-ui/sveltekit-utils/table-query</code
      >
      and work without SvelteKit.
      <code class="text-text-primary">createTableQueryUrlSync</code> in
      <code class="text-text-primary">/url.svelte</code> is the reactive half that needs it.
      <a class="text-primary hover:underline" href={resolve('/table/remote-data')}>Remote Data</a> covers
      the fetch side.
    </p>
  </Section>
</DocsPageLayout>
