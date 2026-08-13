<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout } from '@urbicon-ui/docs';
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
      A column's <code class="text-text-primary">cell</code> property takes a snippet that renders
      that column's cells.
      <code class="text-text-primary">{'<Table>'}</code> also accepts a child snippet named
      <code class="text-text-primary">cell</code> that covers every column at once, and hands it the column
      as a third argument to branch on. Whatever they render, search, sort, grouping and summaries keep
      working on the accessor's output, so a badge or a progress bar never changes what a column sorts
      by.
    </p>

    <CodeExample
      headingLevel={2}
      title="Status Badges & Progress Bars"
      description="Per-column snippets transform raw values into semantic badges and visual progress indicators."
      code={`<script lang="ts">
  import { Table, type Column } from '@urbicon-ui/table';
  import { Badge } from '@urbicon-ui/blocks';

  const columns: Column<Employee>[] = [
    { accessor: 'name', title: 'Name', sortable: true },
    { accessor: 'role', title: 'Role' },
    { accessor: 'status', title: 'Status', cell: statusCell },
    { accessor: 'projects', title: 'Projects', cell: projectsCell }
  ];
<\/script>

{#snippet statusCell(item: Employee, value: unknown)}
  <Badge
    intent={value === 'active' ? 'success' : value === 'on-leave' ? 'warning' : 'danger'}
    size="xs"
  >{value}</Badge>
{/snippet}

{#snippet projectsCell(item: Employee, value: unknown)}
  <div class="flex items-center gap-2">
    <div class="h-1.5 w-16 rounded-full bg-surface-subtle">
      <div class="h-full rounded-full bg-primary" style="width: {(Number(value) / 20) * 100}%"></div>
    </div>
    <span class="text-xs">{value}</span>
  </div>
{/snippet}

<Table items={data} {columns} />`}
    >
      <Table
        cardsBelow="32rem"
        items={employees.slice(0, 6)}
        columns={[
          { accessor: 'name', title: 'Name', sortable: true },
          { accessor: 'role', title: 'Role' },
          { accessor: 'status', title: 'Status', cell: statusCell },
          { accessor: 'projects', title: 'Projects', cell: projectsCell }
        ] as Column<Employee>[]}
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 6 }}
      />
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title="Rich Multi-Info Cells"
      description="Combine avatar initials, name, subtitle, and inline badges for information-dense rows."
      code={`const columns: Column<Employee>[] = [
  { accessor: 'name', title: 'Employee', cell: employeeCell },
  { accessor: 'department', title: 'Department', sortable: true },
  { accessor: 'salary', title: 'Salary', cell: salaryCell, dataType: 'number' },
  { accessor: 'status', title: 'Status', cell: statusCell }
];

{#snippet employeeCell(item: Employee)}
  <div class="flex items-center gap-3">
    <div class="bg-primary-subtle text-primary flex h-8 w-8 shrink-0
             items-center justify-center rounded-full text-xs font-bold">
      {item.name.split(' ').map((n) => n[0]).join('')}
    </div>
    <div class="min-w-0">
      <p class="text-sm font-medium truncate">{item.name}</p>
      <p class="text-xs text-text-tertiary truncate">{item.email}</p>
    </div>
  </div>
{/snippet}

{#snippet salaryCell(item: Employee, value: unknown)}
  <div class="text-right">
    <span class="text-sm font-semibold tabular-nums">
      {Number(value).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
    </span>
    {#if Number(value) > 130000}
      <span class="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-success"></span>
    {/if}
  </div>
{/snippet}`}
    >
      <Table
        cardsBelow="32rem"
        items={employees.slice(0, 6)}
        columns={[
          { accessor: 'name', title: 'Employee', cell: employeeCell },
          { accessor: 'department', title: 'Department', sortable: true },
          { accessor: 'salary', title: 'Salary', cell: salaryCell, dataType: 'number' },
          { accessor: 'status', title: 'Status', cell: statusCell }
        ] as Column<Employee>[]}
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 6 }}
      />
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title="Heat Map Cells"
      description="A background colour derived from the value, so a pattern across rows is visible without reading them. These are literal oklch() colours and stay as they are in dark mode; reach for design tokens when a cell should follow the theme."
      code={`{#snippet heatCell(item: Employee, value: unknown)}
  {@const pct = Math.min(Number(value) / 20, 1)}
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
        cardsBelow="32rem"
        items={employees}
        columns={[
          { accessor: 'name', title: 'Name', sortable: true },
          { accessor: 'role', title: 'Role' },
          { accessor: 'department', title: 'Dept.' },
          { accessor: 'projects', title: 'Projects', cell: heatCell, align: 'center' }
        ] as Column<Employee>[]}
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 6 }}
      />
    </CodeExample>

    <CodeExample
      headingLevel={2}
      title="Global Cell Override"
      description="One snippet renders every column. resolveColumnId returns a column's id, falling back to a string accessor, so it also names function-accessor and synthetic columns."
      code={`<script lang="ts">
  import { resolveColumnId, Table, type Column } from '@urbicon-ui/table';
  import { Badge } from '@urbicon-ui/blocks';
<\/script>

<Table {items} {columns}>
  {#snippet cell(item: Employee, value: unknown, column: Column<Employee>)}
    {#if resolveColumnId(column) === 'department'}
      <Badge variant="outlined" intent="neutral" size="xs">{value}</Badge>
    {:else}
      <span class="text-sm">{value}</span>
    {/if}
  {/snippet}
</Table>`}
    >
      <Table
        cardsBelow="32rem"
        items={employees.slice(0, 4)}
        columns={basicColumns}
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 4 }}
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

    <p class="text-text-secondary text-sm">
      A cell that grows past a few lines is easier to keep as a component.
      <code class="text-text-primary">column.component</code> renders a Svelte component per cell.
      It receives the row as <code class="text-text-primary">item</code>, the table's
      <code class="text-text-primary">size</code> and the column's
      <code class="text-text-primary">align</code>, plus whatever
      <code class="text-text-primary">componentProps(item)</code> returns; the cell value is not
      among them, so read it off <code class="text-text-primary">item</code>.
    </p>

    <p class="text-text-secondary text-sm">
      <code class="text-text-primary">column.formatter</code> is the last path,
      <code class="text-text-primary">{'(value, item) => string | null'}</code>, for a text
      transform with no markup. When several are set on one column, the first of table
      <code class="text-text-primary">cell</code>,
      <code class="text-text-primary">column.cell</code>,
      <code class="text-text-primary">column.component</code> and
      <code class="text-text-primary">column.formatter</code> wins, in that order.
    </p>
  </div>
</DocsPageLayout>
