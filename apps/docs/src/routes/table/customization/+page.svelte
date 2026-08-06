<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { SearchIcon } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { basicColumns, scriptClose, scriptOpen } from '../_data';

  const codePersistence = `${scriptOpen}
  import { Table, createTableView, bindViewToStorage } from '@urbicon-ui/table';

  // The view — which rows the reader is looking at.
  const view = createTableView({ defaults: { pageSize: 25 } });
  const saved = bindViewToStorage(view, { key: 'team-roster' });
${scriptClose}

<!-- The preferences — how the table looks. -->
<Table {items} {columns} {view} prefs={{ storage: 'team-roster', persistSelection: true }} />`;

  const codePersistenceScope = `${scriptOpen}
  const view = createTableView();

  const saved = bindViewToStorage(view, {
    key: 'team-roster',
    axes: ['sort', 'pageSize'], // remember the ordering, forget search and filters
    storage: sessionStorage, // tab-scoped; localStorage is the default
    debounceMs: 500
  });

  // saved.flush() — write the pending change now, e.g. before a programmatic
  //                 navigation; the teardown drops what is still pending.
  // saved.clear() — the "reset saved view" button: removes the stored entry
  //                 and leaves the live view untouched.
${scriptClose}

<Table
  {items}
  {columns}
  {view}
  prefs={{ storage: { key: 'team-roster', kind: 'sessionStorage' } }}
/>`;
</script>

<SeoMeta
  title="Customization - Table"
  description="Empty states, style slot overrides, and state persistence."
/>

<DocsPageLayout
  title="Customization"
  description="Empty states, style slot overrides, and state persistence."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <!-- No <Section> wrapper: this page has one unnamed topic, so there is
       nothing to name, no table of contents to feed and no anchor pointing
       here. A Section that renders no heading is a `<div class="relative">`
       plus an unnamed landmark. The pages in this group with more than one
       topic (filtering, selection, sorting-grouping, column-config,
       live-updates, sticky-pinning) do carry titled sections and a nav.

       `headingLevel={2}` on the examples below is load-bearing, not a
       leftover: with no section heading on the page they are the only h2,
       and dropping them to the default h3 puts an h1 -> h3 skip on the
       page (measured, 2026-08). -->
  <div class="space-y-8">
    <CodeExample
      headingLevel={2}
      title="Custom Empty State"
      description="Override the default empty state with a branded illustration or call-to-action. The snippet renders into the desktop <tbody>, so it must be table-row markup — on mobile the card list shows the plain noDataText instead, since <tr>/<td> cannot live in a <div>. Same for loadingState and errorState."
      code={`<Table {items} {columns}>
  {#snippet emptyState()}
    <tr>
      <td colspan="99" class="py-12 text-center">
        <div class="text-4xl mb-3">\uD83D\uDD0D</div>
        <p class="text-lg font-semibold">No results found</p>
        <p class="text-sm text-text-secondary mt-1">
          Try adjusting your filters or search term.
        </p>
      </td>
    </tr>
  {/snippet}
</Table>`}
    >
      <Table items={[]} columns={basicColumns} enableSmartFilter={false}>
        {#snippet emptyState()}
          <tr>
            <td colspan="99" class="py-12 text-center">
              <div class="mx-auto max-w-xs">
                <SearchIcon size={40} class="text-text-tertiary mx-auto mb-3" />
                <p class="text-text-primary text-lg font-semibold">No results found</p>
                <p class="text-text-secondary mt-1 text-sm">
                  Try adjusting your filters or search term.
                </p>
              </div>
            </td>
          </tr>
        {/snippet}
      </Table>
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title="Style Slot Overrides"
      description="Use slotClasses to add custom classes to specific rendering slots, or unstyled to strip all variant classes for full control."
      code={`<Table
  {items}
  {columns}
  slotClasses={{
    container: 'my-custom-container',
    row: 'hover:bg-primary-subtle',
    headerRow: 'bg-surface-elevated',
    cell: 'px-6',
    filterBar: 'mb-6'
  }}
/>`}
      preview={false}
    />

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">Available Slots</h3>
      <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
        {#each ['container', 'toolbar', 'scrollArea', 'table', 'thead', 'tbody', 'headerRow', 'headerCell', 'row', 'cell', 'groupHeader', 'summaryRow', 'emptyState', 'loadingState', 'errorState', 'filterBar', 'mobileCard'] as slot (slot)}
          <code class="text-primary text-xs">{slot}</code>
        {/each}
      </div>
    </div>

    <CodeExample
      headingLevel={2}
      title="State Persistence"
      description="Two kinds of state, two channels. The view — search, sort, page, page size, filters, grouping — decides which rows a reader sees; it lives on a view object the consumer owns, and bindViewToStorage gives that object a memory. The preferences — hidden columns, column order, summaries, and opt-in selection — decide how the table looks; they belong to the table and go through prefs. Preferences are the table's, the view is the consumer's: nobody wants to share a link that hides columns at the other end. The two channels write separate entries and only share the key here because one name is easier to remember."
      code={codePersistence}
      preview={false}
    />

    <CodeExample
      headingLevel={2}
      title="Narrowing What Is Stored"
      description="axes narrows what is remembered — the default is every axis but the page number. storage takes any Storage object, so sessionStorage scopes the memory to the tab; the preferences channel spells that same choice as its own kind option. Writes are debounced, and bindViewToStorage hands back the two affordances that go with a debounce."
      code={codePersistenceScope}
      preview={false}
    />

    <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
      <h3 class="text-text-primary mb-4 text-sm font-semibold">What Gets Stored</h3>
      <ul class="text-text-secondary list-inside list-disc space-y-2 text-sm">
        <li>
          <strong class="text-text-primary">Every view axis except the page number.</strong>
          Naming a page is what a link is for, so the URL keeps that axis and storage does not — a fresh
          visit starts on page one. The page
          <em>size</em> is stored — "yesterday's page size is still set" is squarely this binding's promise,
          and it is a change from v7, which persisted no pagination at all.
        </li>
        <li>
          <strong class="text-text-primary">Only what the reader changed.</strong>
          A default is never written back, so a value you change in
          <code class="text-text-primary">defaults</code> later reaches everyone who has not overridden
          that axis. What a binding applies is not the reader's doing either — arriving on someone else's
          link leaves the saved view alone.
        </li>
        <li>
          <strong class="text-text-primary">Clearing is a state.</strong>
          An axis the reader emptied — no sort, no filters, no grouping, no summaries, no hidden columns
          — restores empty and wins over the matching default. Only a missing or unreadable entry falls
          back.
        </li>
        <li>
          <strong class="text-text-primary">Selection is off by default.</strong>
          <code class="text-text-primary">persistSelection</code> keys rows by
          <code class="text-text-primary">item.id</code>; without stable ids the selection falls
          back to the row position and restores onto different rows after a reorder.
        </li>
        <li>
          <strong class="text-text-primary">Upgrading from v7:</strong>
          the preferences keep their storage keys, so a reader's column layout survives. The view axes
          moved into one entry per view — the per-axis keys v7 wrote (<code
            class="text-text-primary">table_sort_*</code
          >, <code class="text-text-primary">table_search_*</code>,
          <code class="text-text-primary">table_filters_*</code>,
          <code class="text-text-primary">table_group_by_*</code>) are no longer read.
        </li>
      </ul>
    </div>
  </div>
</DocsPageLayout>
