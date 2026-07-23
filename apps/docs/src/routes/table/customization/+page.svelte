<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { basicColumns } from '../_data';
</script>

<SeoMeta title="Customization - Table" />

<DocsPageLayout
  title="Customization"
  description="Empty states, style slot overrides, and state persistence."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="customization">
    <div class="space-y-8">
      <CodeExample
        title="Custom Empty State"
        description="Override the default empty state with a branded illustration or call-to-action."
        code={`<Table {items} {columns}>
  {#snippet empty()}
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
          {#snippet empty()}
            <tr>
              <td colspan="99" class="py-12 text-center">
                <div class="mx-auto max-w-xs">
                  <div class="text-text-tertiary mx-auto mb-3 text-4xl">🔍</div>
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
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Available Slots</h4>
        <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-3">
          {#each ['container', 'toolbar', 'scrollArea', 'table', 'thead', 'tbody', 'headerRow', 'headerCell', 'row', 'cell', 'groupHeader', 'summaryRow', 'emptyState', 'loadingState', 'errorState', 'filterBar', 'mobileCard'] as slot (slot)}
            <code class="text-primary text-xs">{slot}</code>
          {/each}
        </div>
      </div>

      <CodeExample
        title="State Persistence"
        description="Pass a single tableId to persist every view-state axis across reloads — filters, search, grouping, summary configs, sort, hidden columns, and column order. Defaults to localStorage. Pagination is intentionally not persisted."
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
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
