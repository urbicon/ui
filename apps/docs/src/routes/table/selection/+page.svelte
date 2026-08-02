<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { Button } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose } from '../_data';

  const navigation = [
    { id: 'selection', title: 'Selection Modes' },
    { id: 'controlled-selection', title: 'Controlled Selection' }
  ];

  let controlledIds = $state<Array<string | number>>([1, 3]);

  const codeMultiSelect = `${scriptOpen}
  let selected = [];
${scriptClose}

<Table
  {items}
  {columns}
  selectionMode="multi"
  onSelectionChange={(items) => { selected = items; }}
/>

<p>{selected.length} selected</p>`;

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

<!-- programmatic control -->
<Button onclick={() => (selectedIds = [])}>Clear selection</Button>`;
</script>

<SeoMeta title="Row Selection - Table" />

<DocsPageLayout
  title="Row Selection"
  description="Checkbox-based row selection with single and multi modes and a select-all across all filtered pages."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
  {navigation}
>
  <Section id="selection" title="Selection Modes">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable row selection via checkboxes. Supports
        <code class="text-text-primary">single</code> (radio-like) and
        <code class="text-text-primary">multi</code> (checkbox) modes with a select-all header.
      </p>

      <p class="text-text-secondary text-sm">
        The select-all header checkbox toggles
        <strong class="text-text-primary">every filtered row across all pages</strong>, not just the
        rows on the current page, and its indeterminate state reflects that same set. Selection is
        keyed by <code class="text-text-primary">item.id</code> (falling back to the row index), so it
        survives paging, sorting, and filtering.
      </p>

      <CodeExample
        title="Multi-Select with Callback"
        description="Checkboxes appear automatically. The select-all header toggles every filtered row across all pages — not just the current page."
        code={codeMultiSelect}
      >
        <Table
          items={employees.slice(0, 6)}
          columns={basicColumns}
          selectionMode="multi"
          enableSmartFilter={false}
          itemsPerPage={6}
        />
      </CodeExample>

      <CodeExample
        title="Start Selected"
        description="initialSelectedIds seeds the uncontrolled selection once — no controlled wiring needed for a starting value. Users can change or clear it freely; a selection restored via persistenceConfig.persistSelection takes precedence — including a stored empty one, so deselecting everything stays deselected instead of re-seeding."
        code={`<Table
  {items}
  {columns}
  selectionMode="multi"
  initialSelectedIds={[1, 3]}
/>`}
      >
        <Table
          items={employees.slice(0, 6)}
          columns={basicColumns}
          selectionMode="multi"
          initialSelectedIds={[1, 3]}
          enableSmartFilter={false}
          itemsPerPage={6}
        />
      </CodeExample>

      <CodeExample
        title="Single Select"
        description="Only one row can be selected at a time – previous selection is automatically cleared. Clicking anywhere on the row selects it here (rowClickSelects defaults to true in single mode, and off as soon as onRowClick is set); a click that ends a text selection is ignored, so cell content stays copyable. Pass rowClickSelects explicitly to opt in for multi mode or to keep the checkbox as the only target."
        code={`<Table
  {items}
  {columns}
  selectionMode="single"
  onSelectionChange={(items) => handleSelect(items[0])}
/>`}
      >
        <Table
          items={employees.slice(0, 4)}
          columns={basicColumns}
          selectionMode="single"
          enableSmartFilter={false}
          itemsPerPage={4}
        />
      </CodeExample>
    </div>
  </Section>

  <Section id="controlled-selection" title="Controlled Selection">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        By default the selection is internal, uncontrolled state. Pass the
        <code class="text-text-primary">selectedIds</code> prop to control it from outside —
        preselect rows, drive the selection from URL state, or clear it programmatically. The prop
        is then the source of truth: whenever it changes, the table adopts it. If you only need a
        starting value, prefer
        <code class="text-text-primary">initialSelectedIds</code> above — when both are set,
        controlled
        <code class="text-text-primary">selectedIds</code> wins and the seed is ignored.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary"
          >Controlled selection requires <code>onSelectionChange</code>.</strong
        >
        User interaction still fires the callback — with the selected
        <em>items</em>, not their ids — and you must write the new selection back into the
        <code class="text-text-primary">selectedIds</code> prop there (e.g.
        <code class="text-text-primary">items.map((item) =&gt; item.id)</code>). A controlled table
        that ignores the callback freezes: the stale prop value is re-asserted and user clicks are
        reverted. An empty array is a valid controlled value ("nothing selected");
        <code class="text-text-primary">undefined</code> switches back to uncontrolled. A controlled
        selection is never written to storage —
        <code class="text-text-primary">persistenceConfig.persistSelection</code> has no effect in this
        mode.
      </p>

      <CodeExample
        title="Controlled Multi-Select"
        description="selectedIds drives the table; onSelectionChange writes checkbox interactions back. The buttons set the selection programmatically."
        code={codeControlled}
      >
        <div class="space-y-4">
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
            itemsPerPage={6}
          />
        </div>
      </CodeExample>
    </div>
  </Section>
</DocsPageLayout>
