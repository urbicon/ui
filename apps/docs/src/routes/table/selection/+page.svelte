<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { CodeExample, DocsLayout as DocsPageLayout, Section } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { employees, basicColumns, scriptOpen, scriptClose } from '../_data';

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
</script>

<SeoMeta title="Row Selection - Table" />

<DocsPageLayout
  title="Row Selection"
  description="Checkbox-based row selection with single and multi modes and a select-all across all filtered pages."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="selection">
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
        title="Single Select"
        description="Only one row can be selected at a time – previous selection is automatically cleared."
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
</DocsPageLayout>
