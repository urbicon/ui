<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';
  import LiveUpdatesDemo from './LiveUpdatesDemo.svelte';

  const codeEnable = `<Table
  {items}
  {columns}
  enableLiveUpdates
/>`;

  const codeLiveFeed = `<!-- LiveFeed.svelte — rendered inside the table tree (see below) -->
${scriptOpen}
  import { getTableContext } from '@urbicon-ui/table';

  const table = getTableContext();

  $effect(() => {
    const socket = new WebSocket('wss://api.example.com/orders');
    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'order:created') table.pushInsert(message.order);
      if (message.type === 'order:updated') table.pushUpdate(message.id, message.changes);
      if (message.type === 'order:deleted') table.pushDelete(message.id);
    };
    return () => socket.close();
  });
${scriptClose}`;

  // Display-only specifier. Interpolated (like scriptOpen/scriptClose) so
  // vite's dep-scanner — which regex-extracts imports from the raw script of
  // lang="ts" svelte files without understanding template literals — does not
  // treat the example's `./LiveFeed.svelte` as a real import of a file that
  // only exists in the consumer's project ([UNRESOLVED_IMPORT] warning).
  const liveFeedPath = `'./LiveFeed.svelte'`;

  const codeMount = `${scriptOpen}
  import { Table, SmartFilterBar } from '@urbicon-ui/table';
  import LiveFeed from ${liveFeedPath};
${scriptClose}

<Table {items} {columns} enableLiveUpdates>
  {#snippet toolbar()}
    <LiveFeed />
    <SmartFilterBar />
  {/snippet}
</Table>`;

  const codeAutoApply = `<Table
  {items}
  {columns}
  enableLiveUpdates
  autoApplyOnNavigation={false}
/>`;
</script>

<SeoMeta title="Live Updates - Table" />

<DocsPageLayout
  title="Live Updates"
  description="Non-disruptive real-time data updates with buffering and user-controlled application."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="overview">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        Live-injecting rows into a filtered, sorted, paginated table is disorienting: rows jump
        position mid-read, disappear behind active filters, or conflict with a selection the user is
        building. With <code class="text-text-primary">enableLiveUpdates</code>, the table follows
        the <strong>notification + merge</strong> pattern instead — incoming inserts, updates, and deletes
        are buffered, a banner summarizes what is pending (&ldquo;3 new, 2 updated&rdquo;), and the user
        merges them at a moment of their choosing.
      </p>
      <p class="text-text-secondary text-sm">
        You push changes from any data source — WebSocket, SSE, or polling — through three methods
        on the table context: <code class="text-text-primary">pushInsert</code>,
        <code class="text-text-primary">pushUpdate</code>, and
        <code class="text-text-primary">pushDelete</code>.
      </p>
    </div>
  </Section>

  <Section id="demo">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The panel below plays the role of your backend. Push a few events — the
        <code class="text-text-primary">LiveUpdateBanner</code> appears above the rows and counts
        what is pending. <strong>Apply</strong> merges the buffer into the table,
        <strong>Dismiss</strong> drops it. The demo passes
        <code class="text-text-primary">autoApplyOnNavigation={'{false}'}</code> so pending changes always
        wait for your click.
      </p>

      <LiveUpdatesDemo />
    </div>
  </Section>

  <Section id="enable">
    <div class="space-y-8">
      <CodeExample
        title="Enable live updates"
        description="One prop. When changes are pending, the LiveUpdateBanner renders automatically between the toolbar and the rows, with Apply and Dismiss actions."
        code={codeEnable}
        preview={false}
      />

      <CodeExample
        title="Push changes from your data source"
        description="getTableContext() exposes pushInsert, pushUpdate, and pushDelete. Wire them to whatever delivers your server events — WebSocket, SSE, or polling."
        code={codeLiveFeed}
        preview={false}
      />

      <CodeExample
        title="Mount the feed inside the table tree"
        description="getTableContext() resolves through component context, so the component calling it must render inside the table — the toolbar snippet is the natural mount point. Re-add SmartFilterBar to keep the default search toolbar."
        code={codeMount}
        preview={false}
      />
    </div>
  </Section>

  <Section id="merge-semantics">
    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h4 class="text-text-primary mb-4 text-sm font-semibold">Buffer &amp; merge semantics</h4>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          <code class="text-text-primary">pushInsert</code> deduplicates by row ID — pushing the same
          row twice keeps only the latest version
        </li>
        <li>
          <code class="text-text-primary">pushUpdate</code> merges consecutive changes for the same row;
          only the combined latest state is applied
        </li>
        <li>
          A <code class="text-text-primary">pushDelete</code> for a row that is still a pending insert
          cancels both — the row never appears
        </li>
        <li>On apply, deletes run first, then updates, then inserts</li>
        <li>
          Rows that just received an applied update are highlighted for three seconds, so the change
          is visible even in a long list
        </li>
        <li>Applied deletes also remove the affected rows from the current selection</li>
        <li>
          Updates or deletes for unknown row IDs are skipped (with a console warning in dev builds)
        </li>
      </ul>
    </div>
  </Section>

  <Section id="auto-apply">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        With <code class="text-text-primary">autoApplyOnNavigation</code> (default
        <code class="text-text-primary">true</code>), pending changes are merged automatically when
        the user changes page, sort, filter, or search — the view is reorganizing anyway, so merging
        at that moment is non-disruptive. Set it to
        <code class="text-text-primary">false</code> to make the banner the only way changes are applied.
      </p>
      <CodeExample
        title="Explicit apply only"
        description="Pending changes are never merged implicitly — the user must click Apply (or you call applyAllUpdates() on the context)."
        code={codeAutoApply}
        preview={false}
      />
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
