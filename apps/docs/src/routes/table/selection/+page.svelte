<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose } from '../_data';

  const navigation = [
    { id: 'modes', title: 'Selection Modes' },
    { id: 'row-clicks', title: 'Selecting by Row Click' },
    { id: 'controlled', title: 'Controlled Selection' }
  ];

  let multiSelected = $state<typeof employees>([]);
  let controlledIds = $state<Array<string | number>>([1, 3]);

  const codeMultiSelect = `${scriptOpen}
  let selected = $state([]);
${scriptClose}

<Table
  {items}
  {columns}
  selectionMode="multi"
  onSelectionChange={(items) => (selected = items)}
/>

<p>{selected.length} selected</p>`;

  const codeSingle = `<Table
  {items}
  {columns}
  selectionMode="single"
  onSelectionChange={(items) => handleSelect(items[0])}
/>`;

  const codeControlled = `${scriptOpen}
  let selectedIds = $state<Array<string | number>>([]);
${scriptClose}

<Table
  {items}
  {columns}
  selectionMode="multi"
  {selectedIds}
  onSelectionChange={(items) => (selectedIds = items.map((item) => item.id))}
/>

<Button onclick={() => (selectedIds = [])}>Clear selection</Button>`;
</script>

<SeoMeta
  title="Row Selection - Table"
  description="Checkbox selection for one row or many, with a select-all across every filtered page. The table owns the selected set until you pass selectedIds."
/>

<DocsPageLayout
  title="Row Selection"
  description="Checkbox selection for one row or many, with a select-all across every filtered page. The table owns the selected set until you pass selectedIds."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
  showToc={true}
>
  <Section id="modes" title="Selection Modes">
    <p class="text-text-secondary mb-6 text-sm">
      <code class="text-text-primary">selectionMode</code> switches on a checkbox column.
      <code class="text-text-primary">"multi"</code> lets the user mark any number of rows and adds
      a select-all checkbox to the header; <code class="text-text-primary">"single"</code> keeps one row
      at a time — selecting a row clears the one before.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      Select-all covers every row that matches the current search and filters, on every page — not
      just the rows on screen. While only part of that set is selected, the checkbox shows as
      indeterminate.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      The selection is a set of ids, keyed by <code class="text-text-primary">item.id</code> with
      the row's position as fallback. Sorting, paging and filtering change what is on screen, not
      the set — a selected row that moves to another page stays selected.
      <code class="text-text-primary">onSelectionChange</code> reports the selected items — the rows themselves,
      not their ids.
    </p>

    <CodeExample title="Live — select-all spans both pages" code={codeMultiSelect}>
      <div class="w-full space-y-4">
        <Table
          items={employees.slice(0, 8)}
          columns={basicColumns}
          selectionMode="multi"
          onSelectionChange={(items) => (multiSelected = items)}
          enableSmartFilter={false}
          viewDefaults={{ pageSize: 4 }}
        />
        <p class="text-text-secondary text-sm">{multiSelected.length} selected</p>
      </div>
    </CodeExample>

    <p class="text-text-secondary mt-8 text-sm">
      A row you only show somewhere else — the master/detail pattern — is not a selection.
      <code class="text-text-primary">activeRowId</code> highlights it without bringing the checkbox column
      along.
    </p>
  </Section>

  <Section id="row-clicks" title="Selecting by Row Click">
    <p class="text-text-secondary mb-6 text-sm">
      In <code class="text-text-primary">"single"</code> mode a click anywhere on the row selects it
      — the checkbox is not the only target. With
      <code class="text-text-primary">onRowClick</code> or expandable rows a click already means
      something else, so only the checkbox selects.
      <code class="text-text-primary">rowClickSelects</code> decides explicitly, in either mode.
    </p>

    <CodeExample title="Single select — click the row" code={codeSingle}>
      <Table
        items={employees.slice(0, 4)}
        columns={basicColumns}
        selectionMode="single"
        enableSmartFilter={false}
        viewDefaults={{ pageSize: 4 }}
      />
    </CodeExample>
  </Section>

  <Section id="controlled" title="Controlled Selection">
    <p class="text-text-secondary mb-6 text-sm">
      The table owns the selection until you pass
      <code class="text-text-primary">selectedIds</code> — then your code does. Take it over when
      the set has a life outside the table: preselected from the URL, cleared after a bulk action,
      shared with another view. If all you need is a starting value,
      <code class="text-text-primary">initialSelectedIds</code> seeds the table-owned selection once;
      later changes to the prop are ignored.
    </p>

    <p class="text-text-secondary mb-6 text-sm">
      <code class="text-text-primary">selectedIds</code> drives the table; clicks keep arriving
      through <code class="text-text-primary">onSelectionChange</code> as items, and the write-back
      maps them to ids. An empty array is a valid value — nothing selected;
      <code class="text-text-primary">undefined</code> hands the selection back to the table. A
      controlled selection is never written to storage —
      <code class="text-text-primary">prefs.persistSelection</code> restores only a table-owned one.
    </p>

    <CodeExample
      title="Controlled — buttons and checkboxes write the same set"
      code={codeControlled}
    >
      <div class="w-full space-y-4">
        <div class="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            onclick={() => (controlledIds = employees.slice(0, 6).map((e) => e.id))}
          >
            Select all six
          </Button>
          <Button size="sm" onclick={() => (controlledIds = [])}>Clear</Button>
          <span class="text-text-secondary text-sm">{controlledIds.length} selected</span>
        </div>
        <Table
          items={employees.slice(0, 6)}
          columns={basicColumns}
          selectionMode="multi"
          selectedIds={controlledIds}
          onSelectionChange={(items) => (controlledIds = items.map((item) => item.id))}
          enableSmartFilter={false}
          viewDefaults={{ pageSize: 6 }}
        />
      </div>
    </CodeExample>

    <NoteList variant="flush" class="mt-8">
      <Note title="Write every change back">
        When <code>onSelectionChange</code> does not feed
        <code>selectedIds</code>, clicks still change the screen, nothing warns — and the next
        change to the prop throws the user's clicks away.
      </Note>
    </NoteList>
  </Section>
</DocsPageLayout>
