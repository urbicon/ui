<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { SearchIcon } from '@urbicon-ui/blocks';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { basicColumns } from '../_data';
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
      description="Pass a single tableId to persist every view-state axis across reloads — filters, search, grouping, summary configs, sort, hidden columns, and column order. Defaults to localStorage. Pagination is intentionally not persisted. Clearing counts as state: an axis the user emptied (no sort, no filters, no grouping) restores empty and wins over the matching initial* seed — the seed only fills an axis nothing is stored for."
      code={`<!-- Opt every axis in with one line -->
<Table {items} {columns} persistenceConfig={{ tableId: 'team-roster' }} />

<!-- Granular opt-out: keep the user's column layout, drop their search -->
<Table
{items}
{columns}
persistenceConfig={{
  tableId: 'team-roster',
  persistSearch: false,
  persistFilters: false
}}
/>

<!-- Tab-scoped only (lost on tab close) -->
<Table
{items}
{columns}
persistenceConfig={{ tableId: 'team-roster', storage: 'sessionStorage' }}
/>`}
      preview={false}
    />
  </div>
</DocsPageLayout>
