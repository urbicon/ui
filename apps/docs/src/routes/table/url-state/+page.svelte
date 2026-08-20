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

  const codeServer = `// view-defaults.ts — one declaration, both sides
export const invoiceView = { pageSize: 25 };

// +page.svelte
import { invoiceView } from './view-defaults';
const view = createTableView({ defaults: invoiceView });

// +page.server.ts
import { searchParamsToViewSnapshot } from '@urbicon-ui/sveltekit-utils/table-view';
import { invoiceView } from './view-defaults';

export const load = async ({ url }) => {
  const query = searchParamsToViewSnapshot(url.searchParams, invoiceView);
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
  showToc={true}
>
  <Section id="url-sync" title="View State in the URL">
    <p class="text-text-secondary mb-6 text-sm">
      Six settings decide <em>which</em> rows someone sees:
      <code class="text-text-primary">search</code>, <code class="text-text-primary">sort</code>,
      <code class="text-text-primary">page</code>, <code class="text-text-primary">pageSize</code>,
      <code class="text-text-primary">filters</code> and
      <code class="text-text-primary">groupBy</code>. They live in one object, the view, which you
      create and the table reads.
      <code class="text-text-primary">bindViewToUrl</code> writes that object to the URL as query parameters,
      so reloading restores the view and the address opens the same view for whoever you send it to.
    </p>

    <CodeExample
      title="Live — the table and the address bar"
      description="Running against this page's own address bar. Every key carries the demo_ prefix (?demo_q=…), which is what keeps one table's parameters apart from anything else on the page."
      code={codeUrlSync}
    >
      <UrlStateDemo />
    </CodeExample>

    <p class="text-text-secondary mt-6 mb-6 text-sm">
      Call <code class="text-text-primary">bindViewToUrl</code> at the top level of your component's
      <code class="text-text-primary">{'<script>'}</code>, next to the view it binds: it reads the
      URL right there, synchronously, which is what puts a shared link's sort into the
      server-rendered HTML. The binding tears itself down with the component, so there is no handle
      to keep and nothing to unsubscribe.
    </p>

    <h3 class="text-text-primary mt-8 mb-2 text-base font-semibold">defaults</h3>
    <p class="text-text-secondary mb-4 text-sm">
      <code class="text-text-primary">defaults</code> is written once and does two jobs: it is the
      state the table starts in <em>and</em> what the URL does not repeat. A table sitting in its
      default state writes no parameters at all, and a reader who clears search and sort gets a
      clean address back. Every setting takes one:
      <code class="text-text-primary"
        >{"createTableView({ defaults: { pageSize: 25, sort: { column: 'date', direction: 'desc' } } })"}</code
      >.
      <code class="text-text-primary">{'viewDefaults={{ pageSize: 25 }}'}</code> sets the same defaults
      on a table that owns its view; that table hands you no view object, so a URL binding always creates
      one.
    </p>

    <h3 class="text-text-primary mb-2 text-base font-semibold">What gets written</h3>
    <p class="text-text-secondary mb-6 text-sm">
      Writes are debounced (300 ms) and replace the current history entry, so a burst of sort clicks
      does not flood the back button. <code class="text-text-primary">replaceState: false</code>
      pushes instead, and
      <code class="text-text-primary">{"axes: ['search', 'sort']"}</code> binds fewer than all six settings
      (the setting names above, not the URL keys below).
    </p>
  </Section>

  <Section id="phases" title="Defaults, URL, Storage">
    <p class="text-text-secondary mb-6 text-sm">
      Three places can supply a setting: the defaults you passed, the URL, and (with the storage
      binding from the next section) what the reader left behind last time. Every setting is
      resolved on its own, in phases:
    </p>

    <ol class="text-text-secondary mb-6 list-outside list-decimal space-y-3 pl-5 text-sm">
      <li>
        <strong class="text-text-primary">The defaults.</strong>
        <code>createTableView({'{ defaults }'})</code> is the state the table starts in, during server
        rendering too.
      </li>
      <li>
        <strong class="text-text-primary">The URL, on arrival and on every navigation.</strong> A parameter
        that is present takes its setting, synchronously at initialisation, so it also resolves while
        the server renders. At runtime the URL is the only layer that still applies.
      </li>
      <li>
        <strong class="text-text-primary">Storage, once, after hydration.</strong> It fills the settings
        the arriving URL does not name; from then on it only writes. A setting is stored when its last
        change came from the reader: following someone else's link stores nothing.
      </li>
    </ol>

    <p class="text-text-secondary mb-4 text-sm">Which setting travels under which name:</p>

    <div class="border-border-hairline mb-6 overflow-x-auto border-y">
      <table class="w-full text-left text-sm">
        <thead class="text-text-primary border-border-hairline border-b">
          <tr>
            <th class="py-2 pr-4 font-semibold">Setting</th>
            <th class="py-2 pr-4 font-semibold">In the URL</th>
            <th class="py-2 font-semibold">In storage</th>
          </tr>
        </thead>
        <tbody class="text-text-secondary divide-border-hairline divide-y">
          <tr>
            <td class="py-2 pr-4"><code>search</code></td>
            <td class="py-2 pr-4"><code>q</code></td>
            <td class="py-2">yes</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>sort</code></td>
            <td class="py-2 pr-4"><code>sort</code> + <code>dir</code></td>
            <td class="py-2">yes</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>page</code></td>
            <td class="py-2 pr-4"><code>page</code></td>
            <td class="py-2">never</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>pageSize</code></td>
            <td class="py-2 pr-4"><code>size</code></td>
            <td class="py-2">yes</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>filters</code></td>
            <td class="py-2 pr-4">
              <code>filter=column:operator:value</code>, one per filter
            </td>
            <td class="py-2">yes</td>
          </tr>
          <tr>
            <td class="py-2 pr-4"><code>groupBy</code></td>
            <td class="py-2 pr-4"><code>group</code></td>
            <td class="py-2">yes</td>
          </tr>
          <tr>
            <td class="py-2 pr-4">column visibility, column order, summaries</td>
            <td class="py-2 pr-4">never</td>
            <td class="py-2"><code>prefs</code>, its own entries</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-text-secondary mb-6 text-sm">
      A virtualized table refuses grouping, from the URL like from every other route: a link must
      not switch a large table into a mode that renders every item. The refusal happens in the
      rendering alone — the parameter stays in the address bar, a grouping the reader chose earlier
      survives in storage, and an un-virtualized table on the same view still groups. DEV warns when
      a grouping goes unrendered.
    </p>

    <NoteList variant="flush">
      <Note title="The back button restores the default">
        Navigating to an address without <code>?sort</code> returns the table to its default sort rather
        than to the stored one: storage applies once, after hydration, and never again. The binding keeps
        reading the URL on every navigation, so back and forward work without a remount.
      </Note>
      <Note title="An empty value is a value">
        A URL saying <code>?sort=</code> means "unsorted", <code>?filter=</code> "no filters". The
        markers only appear where the default is not empty (where empty <em>is</em> the default, nothing
        is written), so a setting the reader cleared stays cleared across a reload.
      </Note>
      <Note title="Two URL bindings need distinct prefixes">
        Two bindings claiming the same URL key throw at registration, so a second bound table on the
        page needs a <code>prefix</code>. A URL binding and a storage binding on the same setting
        compose; that pairing is the next section.
      </Note>
    </NoteList>
  </Section>

  <Section id="between-visits" title="Keeping It Between Visits">
    <p class="text-text-secondary mb-6 text-sm">
      While the URL carries the state, the URL <em>is</em> the state. Open the page from a bare link and
      the reader starts clean, because nothing was stored. Business tables usually want the opposite,
      since people expect yesterday's filters to still be there. The second binding is one more line on
      the same object.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      <code class="text-text-primary">bindViewToStorage</code> lives in
      <code class="text-text-primary">@urbicon-ui/table</code>, not in the SvelteKit utilities: web
      storage is a browser API, not a SvelteKit one.
    </p>

    <CodeExample title="Two bindings, one view" code={codeStorage} preview={false} />

    <h3 class="text-text-primary mt-8 mb-2 text-base font-semibold">What is stored</h3>
    <p class="text-text-secondary mb-4 text-sm">
      Five of the six settings, by default: <code class="text-text-primary">search</code>,
      <code class="text-text-primary">sort</code>, <code class="text-text-primary">pageSize</code>,
      <code class="text-text-primary">filters</code> and
      <code class="text-text-primary">groupBy</code>. <code class="text-text-primary">page</code>
      is deliberately out, since page 1 on arrival is standard UX, while
      <code class="text-text-primary">pageSize</code> is in, because "yesterday's page size is still
      set" is squarely what persistence promises. The URL keeps carrying both, so a shared link
      still names its page. Narrow the set with the same
      <code class="text-text-primary">{"axes: ['search', 'sort']"}</code> option, or hand in
      <code class="text-text-primary">sessionStorage</code> via
      <code class="text-text-primary">storage</code>; see
      <a class="text-primary hover:underline" href={resolve('/table/customization')}
        >Customization</a
      >.
    </p>
    <p class="text-text-secondary mb-6 text-sm">
      Only values the reader chose are written:
      <strong class="text-text-primary">a default nobody touched is never stored</strong>. Change
      <code class="text-text-primary">pageSize</code> from 25 to 50 in a later release and everyone
      who never picked a size gets 50; the readers who did keep theirs. The whole view is one entry
      per <code class="text-text-primary">key</code>, so pick a stable, unique one per table: two
      tables sharing a key overwrite each other. Reusing the string from
      <code class="text-text-primary">prefs</code> is a naming convention rather than a link, which
      is why the example above says
      <code class="text-text-primary">'invoices'</code> twice: the two channels keep their own entries,
      and persisting both always takes both statements. A table upgraded from v7 starts from its defaults
      once, since the old per-setting entries are not read.
    </p>

    <h3 class="text-text-primary mb-2 text-base font-semibold">clear and flush</h3>
    <p class="text-text-secondary mb-6 text-sm">
      The binding hands back <code class="text-text-primary">{'{ clear, flush }'}</code>.
      <code class="text-text-primary">clear()</code> is the "reset saved view" button: it empties
      the entry and leaves the live view alone.
      <code class="text-text-primary">flush()</code> forces a pending write out before a programmatic
      navigation: unmounting drops a write still inside the debounce window instead of letting a dead
      table write.
    </p>

    <h3 class="text-text-primary mb-2 text-base font-semibold">The prefs channel</h3>
    <p class="text-text-secondary mb-6 text-sm">
      Column visibility, column order and summaries are <em>not</em> view settings. They are
      presentation rather than selection, so they travel in
      <code class="text-text-primary">prefs</code>
      and never enter the URL: nobody wants to share a link that hides columns on the other end, and the
      server renders every column.
      <code class="text-text-primary"
        >{"prefs={{ storage: 'invoices', persistSelection: true }}"}</code
      > takes the selection along.
    </p>
  </Section>

  <Section id="server" title="What the Server Renders">
    <p class="text-text-secondary mb-6 text-sm">
      The URL reaches the view synchronously, during initialisation, so a
      <code class="text-text-primary">?sort=salary&amp;dir=desc</code> link is already sorted in the
      markup that arrives. View state applied from an
      <code class="text-text-primary">$effect</code> would not be: effects never run while the server
      renders, and the reader would watch the table rearrange itself on hydration.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The server cannot read <code class="text-text-primary">localStorage</code>, so a persisted
      sort would put one row order in the server's HTML and another after hydration. That is why
      storage is a post-hydration phase: the two renders agree, and yesterday's view arrives a
      moment later. The URL is the layer both sides can see.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      A prerendered route has no query string to read at build time, so the binding renders the
      defaults and the client applies the real URL at initialisation. That is what these docs do,
      and the demo above starts working on hydration. A route rendered per request puts the linked
      view into the first response instead.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      When the backend does the sorting and paging (<code class="text-text-primary"
        >{"source={{ processing: 'server' }}"}</code
      >), your
      <code class="text-text-primary">load</code> reads the same parameters.
      <code class="text-text-primary">searchParamsToViewSnapshot</code> resolves them against the
      same defaults object the component hands
      <code class="text-text-primary">createTableView</code>, so an absent parameter resolves on the
      server exactly as it does in the view, from one declaration rather than two. What it returns
      is what a
      <a class="text-primary hover:underline" href={resolve('/table/query')}>query function</a> receives.
    </p>

    <CodeExample title="Seeding the first fetch" code={codeServer} preview={false} />

    <p class="text-text-secondary mt-6 text-sm">
      The serializers live in <code class="text-text-primary"
        >@urbicon-ui/sveltekit-utils/table-view</code
      >
      and work without SvelteKit.
      <code class="text-text-primary">bindViewToUrl</code> in
      <code class="text-text-primary">/url.svelte</code> is the reactive half that needs it.
      <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
        >Server Processing</a
      > covers the fetch side.
    </p>
  </Section>
</DocsPageLayout>
