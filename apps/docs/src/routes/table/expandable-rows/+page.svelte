<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
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
  <Section id="expandable-rows">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Provide an <code class="text-text-primary">expandedRowContent</code> snippet to enable row
        expansion. Each row gets a toggle button. Use
        <code class="text-text-primary">multiExpand</code> to allow multiple rows open at once.
      </p>

      <CodeExample
        title="Expandable Detail Panel"
        description="Click the expand toggle to reveal additional detail for each row."
        code={`<Table {items} {columns}>
  {#snippet expandedRowContent(item)}
    <div class="grid grid-cols-3 gap-4 p-4">
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
          items={employees.slice(0, 6)}
          columns={basicColumns}
          enableSmartFilter={false}
          itemsPerPage={6}
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
                  {item.salary?.toLocaleString()} &euro;
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
  </Section>
</DocsPageLayout>
