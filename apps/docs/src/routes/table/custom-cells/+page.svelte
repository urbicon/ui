<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { resolveColumnId, Table, type Column } from '@urbicon-ui/table';
  import { Badge } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, type Employee } from '../_data';
</script>

{#snippet statusCell(_item: unknown, value: unknown)}
  <Badge
    intent={value === 'active' ? 'success' : value === 'on-leave' ? 'warning' : 'danger'}
    size="xs"
  >
    {value}
  </Badge>
{/snippet}

{#snippet projectsCell(_item: unknown, value: unknown)}
  {@const count = Number(value) || 0}
  <div class="flex items-center gap-2">
    <div class="bg-surface-subtle h-1.5 w-16 overflow-hidden rounded-full">
      <div
        class="bg-primary h-full rounded-full"
        style="width: {Math.min((count / 20) * 100, 100)}%"
      ></div>
    </div>
    <span class="text-text-secondary text-xs">{count}</span>
  </div>
{/snippet}

{#snippet employeeCell(item: { name: string; email: string })}
  <div class="flex items-center gap-3">
    <div
      class="bg-primary-subtle text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
    >
      {item.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')}
    </div>
    <div class="min-w-0">
      <p class="text-text-primary truncate text-sm font-medium">{item.name}</p>
      <p class="text-text-tertiary truncate text-xs">{item.email}</p>
    </div>
  </div>
{/snippet}

{#snippet salaryCell(_item: unknown, value: unknown)}
  <div class="text-right">
    <span class="text-text-primary text-sm font-semibold tabular-nums">
      {(value as number)?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
    </span>
    {#if (value as number) > 130000}
      <span class="bg-success ml-1.5 inline-block h-1.5 w-1.5 rounded-full"></span>
    {/if}
  </div>
{/snippet}

{#snippet heatCell(_item: unknown, value: unknown)}
  {@const pct = Math.min((value as number) / 20, 1)}
  {@const hue = pct * 142}
  <div
    class="mx-auto flex h-8 w-12 items-center justify-center rounded-lg text-xs font-bold tabular-nums"
    style="background: oklch(0.92 0.06 {hue}); color: oklch(0.35 0.12 {hue})"
  >
    {value}
  </div>
{/snippet}

<SeoMeta
  title="Custom Cells - Table"
  description="Per-column snippets and global cell overrides for rich, data-driven cell rendering."
/>

<DocsPageLayout
  title="Custom Cells"
  description="Per-column snippets and global cell overrides for rich, data-driven cell rendering."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="custom-cells">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Two ways to customise rendering: <strong>per-column snippets</strong> via the column's
        <code class="text-text-primary">cell</code> property, or a
        <strong>global cell snippet</strong> on the Table itself. Snippets receive the row item and the
        resolved cell value.
      </p>

      <CodeExample
        title="Status Badges & Progress Bars"
        description="Per-column snippets transform raw values into semantic badges and visual progress indicators."
        code={`{#snippet statusCell(item, value)}
  <Badge
    intent={value === 'active' ? 'success' : value === 'on-leave' ? 'warning' : 'danger'}
    size="xs"
  >{value}</Badge>
{/snippet}

{#snippet projectsCell(item, value)}
  <div class="flex items-center gap-2">
    <div class="h-1.5 w-16 rounded-full bg-surface-subtle">
      <div class="h-full rounded-full bg-primary" style="width: {(value / 20) * 100}%" />
    </div>
    <span class="text-xs">{value}</span>
  </div>
{/snippet}

<Table items={data} columns={[
  { accessor: 'name', title: 'Name', sortable: true },
  { accessor: 'role', title: 'Role' },
  { accessor: 'status', title: 'Status', cell: statusCell },
  { accessor: 'projects', title: 'Projects', cell: projectsCell }
]} />`}
      >
        <Table
          items={employees.slice(0, 6)}
          columns={[
            { accessor: 'name', title: 'Name', sortable: true, searchable: true },
            { accessor: 'role', title: 'Role', sortable: true },
            { accessor: 'status', title: 'Status', cell: statusCell },
            { accessor: 'projects', title: 'Projects', cell: projectsCell, align: 'left' }
          ] as Column<Employee>[]}
          enableSmartFilter={false}
          itemsPerPage={6}
        />
      </CodeExample>

      <CodeExample
        title="Rich Multi-Info Cells"
        description="Combine avatar initials, name, subtitle, and inline badges for information-dense rows."
        code={`{#snippet employeeCell(item)}
  <div class="flex items-center gap-3">
    <div class="bg-primary-subtle text-primary flex h-8 w-8 shrink-0
             items-center justify-center rounded-full text-xs font-bold">
      {item.name.split(' ').map(n => n[0]).join('')}
    </div>
    <div class="min-w-0">
      <p class="text-sm font-medium truncate">{item.name}</p>
      <p class="text-xs text-text-tertiary truncate">{item.email}</p>
    </div>
  </div>
{/snippet}

{#snippet salaryCell(item, value)}
  <div class="text-right">
    <span class="text-sm font-semibold tabular-nums">
      {value?.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
    </span>
    {#if value > 130000}
      <span class="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success" />
    {/if}
  </div>
{/snippet}`}
      >
        <Table
          items={employees.slice(0, 6)}
          columns={[
            { accessor: 'name', title: 'Employee', cell: employeeCell },
            { accessor: 'department', title: 'Department', sortable: true },
            { accessor: 'salary', title: 'Salary', cell: salaryCell, dataType: 'number' },
            { accessor: 'status', title: 'Status', cell: statusCell }
          ] as Column<Employee>[]}
          enableSmartFilter={false}
          itemsPerPage={6}
        />
      </CodeExample>

      <CodeExample
        title="Heat Map Cells"
        description="Conditional background coloring to highlight data patterns – great for KPI dashboards."
        code={`{#snippet heatCell(item, value)}
  {@const pct = Math.min(value / 20, 1)}
  {@const hue = pct * 142}
  <div
    class="mx-auto flex h-8 w-12 items-center justify-center rounded-lg
           text-xs font-bold tabular-nums"
    style="background: oklch(0.92 0.06 {hue}); color: oklch(0.35 0.12 {hue})"
  >
    {value}
  </div>
{/snippet}

<Table items={data} columns={[
  ...,
  { accessor: 'projects', title: 'Projects', cell: heatCell, align: 'center' }
]} />`}
      >
        <Table
          items={employees}
          columns={[
            { accessor: 'name', title: 'Name', sortable: true },
            { accessor: 'role', title: 'Role' },
            { accessor: 'department', title: 'Dept.' },
            { accessor: 'projects', title: 'Projects', cell: heatCell, align: 'center' }
          ] as Column<Employee>[]}
          enableSmartFilter={false}
          itemsPerPage={6}
        />
      </CodeExample>

      <CodeExample
        title="Global Cell Override"
        description="A table-level cell snippet overrides rendering for every column at once – useful for uniform styling."
        code={`<Table {items} {columns}>
  {#snippet cell(item, value, column)}
    {#if resolveColumnId(column) === 'department'}
      <Badge variant="outlined" intent="neutral" size="xs">{value}</Badge>
    {:else}
      <span class="text-sm">{value}</span>
    {/if}
  {/snippet}
</Table>`}
      >
        <Table
          items={employees.slice(0, 4)}
          columns={basicColumns}
          enableSmartFilter={false}
          itemsPerPage={4}
        >
          {#snippet cell(_item: Employee, value: unknown, column: Column<Employee>)}
            {#if resolveColumnId(column) === 'department'}
              <Badge variant="outlined" intent="neutral" size="xs">{value}</Badge>
            {:else}
              <span class="text-sm">{value}</span>
            {/if}
          {/snippet}
        </Table>
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
