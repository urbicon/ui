<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolve } from '$app/paths';
  import { scriptOpen, scriptClose } from '../_data';

  const codeLiveUpdates = `${scriptOpen}
  import { Table, getTableContext } from '@urbicon-ui/table';

  // Inside a child component of Table:
  const ctx = getTableContext();

  socket.on('user:created', (user) => ctx.pushInsert(user));
  socket.on('user:updated', ({ id, ...changes }) => ctx.pushUpdate(id, changes));
  socket.on('user:deleted', (id) => ctx.pushDelete(id));
${scriptClose}

<Table
  {items}
  {columns}
  enableLiveUpdates={true}
  autoApplyOnNavigation={true}
/>`;
</script>

<SeoMeta title="Live Updates - Table" />

<DocsPageLayout
  title="Live Updates"
  description="Non-disruptive real-time data updates with buffering and user-controlled application."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="live-updates">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableLiveUpdates</code> for non-disruptive real-time data
        updates. Changes are buffered and shown in a banner – the user decides when to apply them.
      </p>

      <CodeExample
        title="WebSocket Integration"
        description="Push events from any data source (WebSocket, SSE, polling). The table buffers inserts, updates, and deletes until the user clicks \u2018Apply\u2019."
        code={codeLiveUpdates}
        preview={false}
      />

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Design Rationale</h4>
        <div class="text-text-secondary space-y-3 text-sm">
          <p>
            Live-injecting rows into a filtered, sorted, paginated table causes disorienting UX:
            rows jump position, disappear from filters, or conflict with active selections.
          </p>
          <p>
            Instead, the <strong>Notification + Merge</strong> pattern buffers changes and lets the
            user apply them at a natural transition point. When
            <code class="text-text-primary">autoApplyOnNavigation</code> is enabled (default), pending
            changes merge automatically when the user changes page, sort, or filter.
          </p>
          <p><strong>Features:</strong></p>
          <ul class="list-inside list-disc space-y-1">
            <li>
              Animated <code class="text-text-primary">LiveUpdateBanner</code> shows counts (&ldquo;3
              new, 2 updated, 1 removed&rdquo;)
            </li>
            <li>Multiple updates per item are merged (only latest state applied)</li>
            <li>Pending insert + delete cancel each other out</li>
            <li>Deleted items are removed from selection automatically</li>
            <li>Recently updated rows get a brief visual highlight (3s fade)</li>
          </ul>
        </div>
      </div>
    </div>
  </Section>
</DocsPageLayout>
