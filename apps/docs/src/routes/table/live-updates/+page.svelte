<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import LiveUpdatesDemo from './LiveUpdatesDemo.svelte';

  const codeEnable = `<Table
  {items}
  {columns}
  enableLiveUpdates
/>`;

  const codeLiveFeed = `${scriptOpen}
  import { Table, type TableContext } from '@urbicon-ui/table';

  let table = $state<TableContext | null>(null);

  $effect(() => {
    const ctx = table;
    if (!ctx) return;
    const socket = new WebSocket('wss://api.example.com/orders');
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'order:created') ctx.pushInsert(message.order);
      if (message.type === 'order:updated') ctx.pushUpdate(message.id, message.changes);
      if (message.type === 'order:deleted') ctx.pushDelete(message.id);
    };
    return () => socket.close();
  });
${scriptClose}

<Table
  {items}
  {columns}
  enableLiveUpdates
  onReady={(context) => (table = context)}
/>`;

  // Display-only specifier. Interpolated (like scriptOpen/scriptClose) so
  // vite's dep-scanner — which regex-extracts imports from the raw script of
  // lang="ts" svelte files without understanding template literals — does not
  // treat the example's `./LiveFeed.svelte` as a real import of a file that
  // only exists in the consumer's project ([UNRESOLVED_IMPORT] warning).
  const liveFeedPath = `'./LiveFeed.svelte'`;

  const codeMount = `${scriptOpen}
  // LiveFeed.svelte calls getTableContext(), so it must render inside the table
  import { Table, SmartFilterBar } from '@urbicon-ui/table';
  import LiveFeed from ${liveFeedPath};
${scriptClose}

<Table {items} {columns} enableLiveUpdates>
  {#snippet toolbar()}
    <LiveFeed />
    <SmartFilterBar />
  {/snippet}
</Table>`;

  const navigation = [
    { id: 'overview', title: 'Overview' },
    { id: 'demo', title: 'Demo' },
    { id: 'enable', title: 'Enabling live updates' },
    { id: 'merge-semantics', title: 'Buffer & merge semantics' },
    { id: 'auto-apply', title: 'Auto-apply on navigation' }
  ];

  const codeAutoApply = `<Table
  {items}
  {columns}
  enableLiveUpdates
  autoApplyOnNavigation={false}
/>`;
</script>

<SeoMeta
  title="Live Updates - Table"
  description="Non-disruptive real-time data updates with buffering and user-controlled application."
/>

<DocsPageLayout
  title="Live Updates"
  description="Non-disruptive real-time data updates with buffering and user-controlled application."
  {navigation}
  showToc={true}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview" title="Overview">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Writing rows straight into a filtered, sorted, paged table is disorienting: rows jump
        position mid-read, disappear behind an active filter, or land in a selection the reader is
        still building. <code class="text-text-primary">enableLiveUpdates</code> buffers them instead.
        A banner above the rows counts what is waiting (&ldquo;3 new, 2 updated, 1 deleted&rdquo;) and
        the reader merges it with a click. By default the table also merges at the next sort, filter or
        page change, when the view is reorganizing anyway.
      </p>
      <p class="text-text-secondary text-sm">
        You push changes from any data source (WebSocket, SSE, polling) through three methods on the
        table context: <code class="text-text-primary">pushInsert</code>,
        <code class="text-text-primary">pushUpdate</code> and
        <code class="text-text-primary">pushDelete</code>. Rows are matched by
        <code class="text-text-primary">item.id</code>, and
        <code class="text-text-primary">pushUpdate(id, changes)</code> merges
        <code class="text-text-primary">changes</code> into the row, so a message carrying only
        <code class="text-text-primary">{'{ status }'}</code> leaves the other fields alone.
      </p>
    </div>
  </Section>

  <Section id="demo" title="Demo">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The panel below plays the role of your backend. Push a few events and the
        <code class="text-text-primary">LiveUpdateBanner</code> appears above the rows, counting
        what is pending. <strong>Apply</strong> merges the buffer into the table,
        <strong>Dismiss</strong> drops it. The demo passes
        <code class="text-text-primary">autoApplyOnNavigation={'{false}'}</code> so pending changes always
        wait for your click.
      </p>

      <LiveUpdatesDemo />
    </div>
  </Section>

  <Section id="enable" title="Enabling live updates">
    <div class="space-y-8">
      <CodeExample
        title="Enable live updates"
        description="One prop. When changes are pending, the LiveUpdateBanner renders automatically between the toolbar and the rows, with Apply and Dismiss actions."
        code={codeEnable}
        preview={false}
      />

      <CodeExample
        title="Push changes from your data source"
        description="onReady hands you the table context from outside the table, with pushInsert, pushUpdate and pushDelete on it. Wire them to whatever delivers your server events: WebSocket, SSE, or polling."
        code={codeLiveFeed}
        preview={false}
      />

      <CodeExample
        title="Alternative: a feed component inside the table tree"
        description="If the feed is its own component it can call getTableContext(), which resolves through component context: it has to render inside the table, and the toolbar snippet is the natural mount point. Overriding toolbar replaces the default one, so re-add SmartFilterBar to keep the search field."
        code={codeMount}
        preview={false}
      />
    </div>
  </Section>

  <Section id="merge-semantics" title="Buffer & merge semantics">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The buffer holds at most one pending outcome per row, so a busy feed cannot make it grow
        past the number of rows it touched. A second
        <code class="text-text-primary">pushInsert</code> replaces the first, consecutive
        <code class="text-text-primary">pushUpdate</code> calls merge into one, a
        <code class="text-text-primary">pushDelete</code> for a row that is still a pending insert
        cancels both, and a <code class="text-text-primary">pushUpdate</code> for one is folded into the
        insert so the row lands already updated. Order of arrival does not matter.
      </p>

      <p class="text-text-secondary text-sm">
        Applying runs deletes, then updates, then inserts. A row that just took an update is
        highlighted for three seconds, so the change is findable in a long list, and a deleted row
        drops out of the selection along with the table. Updates and deletes are matched against all
        of <code class="text-text-primary">items</code>, not just the rows on screen, so a filter or
        a page never swallows one; an id that is nowhere in the data is skipped, with a warning in
        dev.
      </p>
    </div>
  </Section>

  <Section id="auto-apply" title="Auto-apply on navigation">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        With <code class="text-text-primary">autoApplyOnNavigation</code> (default
        <code class="text-text-primary">true</code>), pending changes are merged automatically when
        the user changes page, sort, filter or search: the view is reorganizing anyway, so merging
        at that moment is non-disruptive. Set it to
        <code class="text-text-primary">false</code> to make the banner the only way changes are applied.
      </p>
      <CodeExample
        title="Explicit apply only"
        description="Pending changes are never merged implicitly: the user clicks Apply, or you call applyAllUpdates() on the context. Its counterpart is dismissAllUpdates()."
        code={codeAutoApply}
        preview={false}
      />
    </div>
  </Section>
</DocsPageLayout>
