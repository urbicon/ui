<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { page } from '$app/state';
  import PrevNextNav from '$lib/PrevNextNav.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { Input } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose } from '../_data';

  const navigation = [
    { id: 'filtering', title: 'Smart Filter Bar', order: 1 },
    { id: 'filter-operators', title: 'Filter Operators', order: 2 },
    { id: 'controlled-search', title: 'Controlled Search', order: 3 }
  ];

  let searchTerm = $state('');

  const operators = [
    {
      op: 'contains',
      desc: 'Case-insensitive substring match. Offered for text columns (the default).'
    },
    {
      op: 'equals',
      desc: 'Case-insensitive exact match on the stringified value. Offered for text, number, and date columns (labeled "on date" for dates).'
    },
    {
      op: 'startsWith',
      desc: 'Case-insensitive prefix match. Offered for text columns.'
    },
    {
      op: 'endsWith',
      desc: 'Case-insensitive suffix match. Offered for text columns.'
    },
    {
      op: 'greaterThan',
      desc: 'Numeric comparison — both sides are converted via Number() at compare time. Offered for number columns and as "after" for date columns.'
    },
    {
      op: 'lessThan',
      desc: 'Numeric comparison — both sides are converted via Number() at compare time. Offered for number columns and as "before" for date columns.'
    }
  ];

  const codeControlledSearch = `${scriptOpen}
  let searchTerm = $state('');
${scriptClose}

<Input bind:value={searchTerm} label="Search from outside the table" clearable />

<Table
  {items}
  {columns}
  {searchTerm}
  onSearchTermChange={(term) => (searchTerm = term)}
/>`;
</script>

<SeoMeta title="Filtering & Search - Table" />

<DocsPageLayout
  title="Filtering & Search"
  description="Built-in search, column filters, summary controls, and column visibility via the SmartFilterBar — plus a controlled search term for external search UIs."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="filtering" title="Smart Filter Bar">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable <code class="text-text-primary">enableSmartFilter</code> to get a full-featured toolbar
        with search, per-column filters, grouping controls, summary aggregations, and a column visibility
        menu.
      </p>

      <CodeExample
        title="Smart Filter Bar"
        description="Search across all searchable columns. Add per-column filters via the filter button. Debounce controls request frequency."
        code={`<Table
  {items}
  {columns}
  enableSmartFilter={true}
  searchPlaceholder="Search employees..."
  searchDebounceMs={300}
/>`}
      >
        <Table
          items={employees}
          columns={basicColumns}
          enableSmartFilter={true}
          searchPlaceholder="Search employees..."
          itemsPerPage={6}
        />
      </CodeExample>
    </div>
  </Section>

  <Section id="filter-operators" title="Filter Operators">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Per-column filters are added through the filter button in the SmartFilterBar. Each filter is
        a plain object — <code class="text-text-primary">&#123; column, operator, value &#125;</code
        >
        — and every active filter must match for a row to stay visible (AND semantics).
        <code class="text-text-primary">value</code> is always a string, even for numeric operators:
        the comparison converts via <code class="text-text-primary">Number()</code> internally,
        which keeps filters serializable for persistence. Which operators the menu offers is driven
        by the column's <code class="text-text-primary">dataType</code>; columns with
        <code class="text-text-primary">searchable: false</code> (and synthetic columns without an accessor)
        do not appear in the filter menu at all.
      </p>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Operator Reference</h4>
        <div class="grid grid-cols-1 gap-x-8 gap-y-3 text-sm md:grid-cols-2">
          {#each operators as item (item.op)}
            <div>
              <code class="text-primary text-xs">{item.op}</code>
              <p class="text-text-tertiary text-xs">{item.desc}</p>
            </div>
          {/each}
        </div>
      </div>

      <p class="text-text-secondary text-sm">
        To start with filters active, pass
        <code class="text-text-primary">initialFilters</code> — an array of the same
        <code class="text-text-primary">&#123; column, operator, value &#125;</code> objects. It
        seeds the uncontrolled filter state once (the chips show them; users can still remove or add
        filters), and filters restored via
        <code class="text-text-primary">persistenceConfig</code>
        (<code class="text-text-primary">persistFilters</code>) take precedence.
      </p>

      <p class="text-text-secondary text-sm">
        Both search and filters match against the column accessor's output — not against what a
        custom cell renders. In
        <code class="text-text-primary">mode="server"</code> the table does not filter locally:
        active filters arrive as <code class="text-text-primary">activeFilters</code> on the query
        object — see
        <a href={resolve('/table/remote-data')} class="text-primary hover:underline">Remote Data</a
        >.
      </p>
    </div>
  </Section>

  <Section id="controlled-search" title="Controlled Search">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        By default the search term is internal, uncontrolled state. Pass the
        <code class="text-text-primary">searchTerm</code> prop to control it from outside — the prop
        then drives the table's search, and
        <code class="text-text-primary">onSearchTermChange</code> fires on every internal change
        (typing in the SmartFilterBar, Escape-to-clear) so you can write the value back. An empty
        string is a valid controlled value ("no search"); leave the prop
        <code class="text-text-primary">undefined</code> for uncontrolled search. A controlled term
        takes precedence over a persisted one (<code class="text-text-primary"
          >persistenceConfig.persistSearch</code
        >). <code class="text-text-primary">onSearchTermChange</code> also works on its own to observe
        the uncontrolled value — for example to mirror it into the URL.
      </p>

      <CodeExample
        title="External Search Field"
        description="The input and the table's own SmartFilterBar stay in sync: the input drives searchTerm, and onSearchTermChange writes internal changes back."
        code={codeControlledSearch}
      >
        <div class="space-y-4">
          <Input
            bind:value={searchTerm}
            label="Search from outside the table"
            placeholder="Try 'platform' or 'berlin'..."
            clearable
          />
          <Table
            items={employees}
            columns={basicColumns}
            {searchTerm}
            onSearchTermChange={(term) => (searchTerm = term)}
            itemsPerPage={6}
          />
        </div>
      </CodeExample>
    </div>
  </Section>

  <PrevNextNav currentPath={page.url.pathname} />
</DocsPageLayout>
