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
  description="Checkbox-based row selection with single and multi modes, select-all, and Shift+Click range selection."
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="selection">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        Enable row selection via checkboxes. Supports
        <code class="text-text-primary">single</code> (radio-like) and
        <code class="text-text-primary">multi</code> (checkbox) modes with a select-all header.
      </p>

      <CodeExample
        title="Multi-Select with Callback"
        description="Checkboxes appear automatically. The select-all header toggles all visible (filtered) items. Shift+Click for range selection."
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
        description="Only one row can be selected at a time \u2013 previous selection is automatically cleared."
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
