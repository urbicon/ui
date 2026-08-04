<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    Section,
    TypesReference
  } from '@urbicon-ui/docs';
  import { Table } from '@urbicon-ui/table';
  import Playground from './Playground.svelte';
  import { componentData } from './api';
  import { asset, resolve } from '$app/paths';
  import { employees, factoryColumns, scriptOpen, scriptClose } from '../_data';

  const codeFactoryTable = `${scriptOpen}
  import { Table, TableColumns } from '@urbicon-ui/table';

  const cols = [
    TableColumns.userAvatar('name', 'Employee'),
    TableColumns.text('role', 'Role'),
    TableColumns.text('department', 'Department'),
    TableColumns.status('status', 'Status'),
    TableColumns.number('salary', 'Salary'),
    TableColumns.date('joinedAt', 'Joined'),
    TableColumns.actions('Actions', { onView: () => {}, onEdit: () => {} })
  ];
${scriptClose}

<Table {items} columns={cols} />`;

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'column-factories', title: 'Column Factories' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];
</script>

<!-- urbicon-ignore heading-skip — false positive. Rendered, the outline
     reads h2 (section), then h3 (CodeExample title), then h4, with no skip; the
     rule only knows `Section` as a heading-rendering component and cannot
     see the h3 a CodeExample title emits between the two. Verified against
     the served HTML, 2026-08. Tracked as issue #99. -->

<SeoMeta
  title="Table Component"
  description="Advanced data table with smart filtering, column factories, grouping, summaries, and responsive mobile layout."
/>

<DocsPageLayout
  title="Table"
  description="Advanced data table with smart filtering, column factories, grouping, summaries, and responsive mobile layout."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[{ label: 'Home', href: resolve('/') }]}
  {navigation}
>
  <!--
    Der frühere "Full Setup"-Kasten ist weg: Er hielt eine zweite, von Hand
    gepflegte Kopie der Spalten und Daten als Text — die weder die
    Live-Einstellungen abbildete noch die Tabelle selbst zeigte. Der Playground
    druckt beides jetzt aus denselben Objekten, die er rendert.
  -->
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <Section id="column-factories" title="Column Factories">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">TableColumns</code> creates pre-configured columns with the right
        cell components, alignment, and sorting – no manual wiring.
      </p>

      <CodeExample
        title="Factory-Powered Table"
        description="Avatar, text, status badge, number, date, and action columns – six lines of config."
        code={codeFactoryTable}
      >
        <Table
          items={employees}
          columns={factoryColumns}
          itemsPerPage={6}
          enableSmartFilter={false}
        />
      </CodeExample>

      <div class="border-border-subtle bg-surface-elevated rounded-2xl border p-6">
        <h4 class="text-text-primary mb-4 text-sm font-semibold">Available Factories</h4>
        <div class="grid grid-cols-2 gap-x-8 gap-y-3 text-sm md:grid-cols-4">
          {#each [{ name: 'text', desc: 'Plain text with optional formatter' }, { name: 'number', desc: 'Right-aligned numeric values' }, { name: 'date', desc: 'Formatted date display' }, { name: 'status', desc: 'Colored status badges' }, { name: 'userAvatar', desc: 'Avatar + name combo' }, { name: 'link', desc: 'Clickable URL cells' }, { name: 'copy', desc: 'Copy-to-clipboard button' }, { name: 'actions', desc: 'View / Edit / Delete buttons' }] as factory (factory.name)}
            <div>
              <code class="text-primary text-xs">{factory.name}</code>
              <p class="text-text-tertiary text-xs">{factory.desc}</p>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </Section>

  <Section id="api" title="API Reference" intent="secondary">
    <ApiReference props={componentData?.props ?? []} types={componentData?.types ?? []} />
  </Section>

  <TypesReference types={componentData?.types ?? []} />

  <Section id="installation" title="Installation">
    <CodeExample
      title="Import"
      code={`import { Table, TableColumns } from '@urbicon-ui/table';`}
      language="svelte"
      preview={false}
    />
    <div class="mt-4">
      <CodeExample
        title="Styles"
        description="Import the table theme CSS in your app's root layout or entry point."
        code="import '@urbicon-ui/table/style/index.css';"
        language="typescript"
        preview={false}
      />
    </div>
  </Section>

  <div class="mt-6 text-right">
    <a
      class="text-text-tertiary hover:text-text-secondary text-sm underline"
      href={asset('/table/table/llm.txt')}
      rel="noopener">llm.txt</a
    >
  </div>
</DocsPageLayout>
