<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    ApiReference,
    CodeExample,
    DocsLayout as DocsPageLayout,
    PlaygroundConfigurator,
    Section
  } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { componentData } from './api';
  import { asset, resolve } from '$app/paths';
  import { employees, factoryColumns, scriptOpen, scriptClose } from '../_data';

  const playgroundCode = `${scriptOpen.replace('>', ' lang="ts">')}
  import { Table } from '@urbicon-ui/table';
  import '@urbicon-ui/table/style/index.css';

  const columns = [
    { accessor: 'name', title: 'Name', sortable: true, searchable: true },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    { accessor: 'location', title: 'Location', sortable: true }
  ];

  const items = [
    { id: 1, name: 'Emma Wilson', role: 'Staff Engineer', department: 'Platform', location: 'Berlin' },
    { id: 2, name: 'Liam Chen', role: 'Product Designer', department: 'Design', location: 'Hamburg' },
    { id: 3, name: 'Sofia Martinez', role: 'Eng. Manager', department: 'Platform', location: 'Munich' },
    { id: 4, name: 'James Park', role: 'Frontend Dev', department: 'Product', location: 'Remote' },
    { id: 5, name: 'Aisha Patel', role: 'Data Scientist', department: 'Data', location: 'Berlin' }
  ];
${scriptClose}

<Table
  {items}
  {columns}
  size="md"
  itemsPerPage={5}
  enableSmartFilter={true}
  searchPlaceholder="Search team..."
/>`;

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
    { id: 'playground', title: 'Playground', order: 1 },
    { id: 'column-factories', title: 'Column Factories', order: 2 },
    { id: 'api', title: 'API Reference', order: 3 },
    { id: 'installation', title: 'Installation', order: 4 }
  ];

  type PlaygroundItem = {
    id: number;
    name: string;
    role: string;
    department: string;
    location: string;
  };

  const playgroundColumns: Column<PlaygroundItem>[] = [
    { accessor: 'name', title: 'Name', sortable: true, searchable: true },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    { accessor: 'location', title: 'Location', sortable: true }
  ];

  const playgroundItems: PlaygroundItem[] = [
    {
      id: 1,
      name: 'Emma Wilson',
      role: 'Staff Engineer',
      department: 'Platform',
      location: 'Berlin'
    },
    {
      id: 2,
      name: 'Liam Chen',
      role: 'Product Designer',
      department: 'Design',
      location: 'Hamburg'
    },
    {
      id: 3,
      name: 'Sofia Martinez',
      role: 'Eng. Manager',
      department: 'Platform',
      location: 'Munich'
    },
    {
      id: 4,
      name: 'James Park',
      role: 'Frontend Dev',
      department: 'Product',
      location: 'Remote'
    },
    {
      id: 5,
      name: 'Aisha Patel',
      role: 'Data Scientist',
      department: 'Data',
      location: 'Berlin'
    },
    {
      id: 6,
      name: 'Noah Kim',
      role: 'DevOps Engineer',
      department: 'Platform',
      location: 'Hamburg'
    },
    {
      id: 7,
      name: 'Olivia Brown',
      role: 'UX Researcher',
      department: 'Design',
      location: 'Munich'
    },
    {
      id: 8,
      name: 'Lucas Weber',
      role: 'Backend Dev',
      department: 'Product',
      location: 'Berlin'
    }
  ];
</script>

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
  <Section id="playground" intent="primary">
    <PlaygroundConfigurator
      componentName="Table"
      controls={[
        {
          type: 'dropdown',
          key: 'appearance',
          label: 'Appearance',
          items: [
            { label: 'flush', value: 'flush' },
            { label: 'surface', value: 'surface' },
            { label: 'framed', value: 'framed' }
          ],
          defaultValue: 'flush'
        },
        {
          type: 'dropdown',
          key: 'size',
          label: 'Size',
          items: [
            { label: 'sm', value: 'sm' },
            { label: 'md', value: 'md' },
            { label: 'lg', value: 'lg' }
          ],
          defaultValue: 'md'
        },
        {
          type: 'number',
          key: 'itemsPerPage',
          label: 'Items per page',
          min: 3,
          max: 20,
          step: 1,
          defaultValue: 5
        },
        {
          type: 'checkbox',
          key: 'enableSmartFilter',
          label: 'Smart Filter',
          defaultValue: true
        },
        {
          type: 'text',
          key: 'searchPlaceholder',
          label: 'Search Placeholder',
          defaultValue: 'Search team...'
        }
      ]}
      values={{
        appearance: 'flush',
        size: 'md',
        itemsPerPage: 5,
        enableSmartFilter: true,
        searchPlaceholder: 'Search team...'
      }}
      showHeader={false}
    >
      {#snippet children(values)}
        <Table
          appearance={values.appearance}
          size={values.size}
          itemsPerPage={values.itemsPerPage}
          enableSmartFilter={values.enableSmartFilter}
          searchPlaceholder={values.searchPlaceholder}
          columns={playgroundColumns}
          items={playgroundItems}
        />
      {/snippet}
    </PlaygroundConfigurator>

    <div class="mt-6">
      <CodeExample
        title="Full Setup"
        description="Complete code for the playground above — columns, data, and props."
        code={playgroundCode}
        language="svelte"
        preview={false}
      />
    </div>
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
    <ApiReference props={componentData?.props ?? []} />
  </Section>

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
