<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns } from '../_data';
</script>

<SeoMeta
  title="Expandable Rows - Table"
  description="Reveal additional detail for each row via an expand toggle."
/>

<DocsPageLayout
  title="Expandable Rows"
  description="Reveal additional detail for each row via an expand toggle."
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
    <p class="text-text-secondary text-sm">
      Provide an <code class="text-text-primary">expandedRowContent</code> snippet and every row
      gets a toggle that reveals it, with the row's item as its argument. Opening a row closes the
      one before it; add <code class="text-text-primary">multiExpand</code> to keep several open at once.
    </p>

    <CodeExample
      headingLevel={2}
      title="Expandable Detail Panel"
      description="The panel is a row of its own that spans every column, so the layout inside it is yours to choose."
      code={`<Table {items} {columns}>
  {#snippet expandedRowContent(item)}
    <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
      <div>
        <span class="text-xs text-text-tertiary">Email</span>
        <p class="text-sm">{item.email}</p>
      </div>
      <div>
        <span class="text-xs text-text-tertiary">Salary</span>
        <p class="text-sm">{item.salary.toLocaleString()} \u20AC</p>
      </div>
      <div>
        <span class="text-xs text-text-tertiary">Projects</span>
        <p class="text-sm">{item.projects}</p>
      </div>
    </div>
  {/snippet}
</Table>`}
    >
      <Table
        cardsBelow="32rem"
        items={employees.slice(0, 6)}
        columns={basicColumns}
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 6 }}
      >
        {#snippet expandedRowContent(item)}
          <div class="grid grid-cols-1 gap-4 p-4 md:grid-cols-3">
            <div>
              <span class="text-text-tertiary text-xs">Email</span>
              <p class="text-text-primary text-sm">{item.email}</p>
            </div>
            <div>
              <span class="text-text-tertiary text-xs">Salary</span>
              <p class="text-text-primary text-sm">
                {item.salary.toLocaleString()} &euro;
              </p>
            </div>
            <div>
              <span class="text-text-tertiary text-xs">Projects</span>
              <p class="text-text-primary text-sm">{item.projects}</p>
            </div>
          </div>
        {/snippet}
      </Table>
    </CodeExample>
  </div>
</DocsPageLayout>
