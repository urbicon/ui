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
  import { Table, TableColumns, type Column } from '@urbicon-ui/table';

  type Employee = {
    id: number;
    name: string;
    role: string;
    status: string;
    salary: number;
    joinedAt: string;
  };

  // Rows are keyed by \`id\` when they have one, by array index otherwise.
  const items: Employee[] = [
    {
      id: 1, name: 'Emma Wilson', role: 'Staff Engineer',
      status: 'active', salary: 142000, joinedAt: '2021-03-15'
    }
    // …
  ];

  // The annotation is what checks the accessors: with \`Column<Employee>[]\`,
  // a first argument that is not a key of the row is a type error. Without
  // it, nothing checks them.
  const cols: Column<Employee>[] = [
    TableColumns.userAvatar('name', 'Employee'),
    TableColumns.text('role', 'Role'),
    // StatusBadge knows eleven statuses: active, inactive, pending, online,
    // offline, processing, completed, failed, draft, published, archived.
    // Anything else reads "Unknown" until you name it here.
    TableColumns.status('status', 'Status', {
      statusMap: {
        'on-leave': { intent: 'warning', text: 'On leave', icon: true },
        offboarding: { intent: 'neutral', text: 'Offboarding', icon: false }
      }
    }),
    TableColumns.number('salary', 'Salary'),
    TableColumns.date('joinedAt', 'Joined'),
    // Every handler receives the row. showView defaults to false, showDelete
    // to true, and a delete button with no handler still renders.
    TableColumns.actions('Actions', {
      onView: (employee) => {},
      onEdit: (employee) => {},
      showView: true,
      showDelete: false
    })
  ];
${scriptClose}

<Table
  {items}
  columns={cols}
  cardsBelow="36rem"
  viewDefaults={{ pageSize: 6 }}
  enableSmartFilter={false}
/>`;

  const navigation = [
    { id: 'playground', title: 'Playground' },
    { id: 'column-factories', title: 'Column Factories' },
    { id: 'next', title: 'Where to go next' },
    { id: 'api', title: 'API Reference' },
    { id: 'types', title: 'Types' },
    { id: 'installation', title: 'Installation' }
  ];

  // `TableColumns` is a value export, so no generated Types entry carries it —
  // this list is the only documentation the nine factories have, and it is
  // therefore worth keeping against `packages/table/src/lib/factories/
  // TableColumns.ts`. It listed eight until 2026-08-07: `custom` had been
  // missing since it was added, which presents as an absent feature rather
  // than a wrong one and so goes unreported.
  const factories = [
    { name: 'text', desc: 'Plain text, with an optional formatter' },
    { name: 'number', desc: 'Right-aligned, locale-aware number formatting' },
    { name: 'date', desc: 'Locale-aware date formatting' },
    { name: 'status', desc: 'Coloured badge, centred and groupable' },
    { name: 'userAvatar', desc: 'Avatar next to the name' },
    { name: 'link', desc: 'Renders the value as an anchor' },
    { name: 'copy', desc: 'Click-to-copy button, centred and unsortable' },
    {
      name: 'custom',
      desc: 'The value as text, with your own classes, wrapping and click handling'
    },
    { name: 'actions', desc: 'View / edit / delete buttons; synthetic, no accessor' }
  ];
</script>

<!-- urbicon-ignore heading-skip — false positive. Rendered, the outline
     reads h2 (section), then h3 (CodeExample title), then h4, with no skip; the
     rule only knows `Section` as a heading-rendering component and cannot
     see the h3 a CodeExample title emits between the two. Verified against
     the served HTML, 2026-08. Tracked as issue #99. -->

<SeoMeta
  title="Table Component"
  description="A data table that sorts, filters, groups and pages your rows, in the browser or against your backend. Becomes a card list when its own container gets too narrow for a grid."
/>

<DocsPageLayout
  title="Table"
  description="A data table that sorts, filters, groups and pages your rows, in the browser or against your backend. Becomes a card list when its own container gets too narrow for a grid."
  maxWidth="2xl"
  showToc={true}
  breadcrumbs={[{ label: 'Home', href: resolve('/') }]}
  {navigation}
>
  <!-- The former "Full Setup" box is gone: it held a second, hand-maintained
       copy of the columns and the data as text, which neither reflected the
       live settings nor showed the table itself. The playground now prints
       both from the very objects it renders. -->
  <Section id="playground" title="Playground" titleHidden intent="primary">
    <Playground />
  </Section>

  <Section id="column-factories" title="Column Factories">
    <div class="space-y-8">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">TableColumns</code> builds a column with the cell component,
        the alignment and the flags already set, so a typed column is one call. For a column no
        factory covers, write the object yourself:
        <a class="text-primary hover:underline" href={resolve('/table/column-config')}
          >Column Configuration</a
        >.
      </p>

      <CodeExample
        title="Factory-Powered Table"
        description="Eight of the nine take (accessor, title, options); actions takes (title, options), since it reads no field."
        code={codeFactoryTable}
      >
        <Table
          items={employees}
          columns={factoryColumns}
          cardsBelow="36rem"
          viewDefaults={{ pageSize: 6 }}
          enableSmartFilter={false}
        />
      </CodeExample>

      <p class="text-text-secondary text-sm">All nine:</p>

      <div class="border-border-hairline overflow-x-auto border-y">
        <table class="w-full text-left text-sm">
          <thead class="text-text-primary border-border-hairline border-b">
            <tr>
              <th class="py-2 pr-4 font-semibold">Factory</th>
              <th class="py-2 font-semibold">What it builds</th>
            </tr>
          </thead>
          <tbody class="text-text-secondary divide-border-hairline divide-y">
            {#each factories as factory (factory.name)}
              <tr>
                <td class="py-2 pr-4"><code class="text-text-primary">{factory.name}</code></td>
                <td class="py-2">{factory.desc}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  </Section>

  <Section id="next" title="Where to go next">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">Who does the work.</strong> A few hundred rows sort,
        filter and page in the browser:
        <a class="text-primary hover:underline" href={resolve('/table/client-processing')}
          >Client Processing</a
        >. Past a few thousand it becomes the backend's job, and you hand the table one page at a
        time:
        <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
          >Server Processing</a
        >. Give it a
        <code class="text-text-primary">query</code> function and it runs the fetch itself:
        <a class="text-primary hover:underline" href={resolve('/table/query')}>Query Function</a>.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">What the reader can change.</strong> Six settings decide
        which rows they see: search, sort, page, page size, filters and grouping. They live in one
        <code class="text-text-primary">view</code> object (<code class="text-text-primary"
          >viewDefaults</code
        >
        sets its starting values), and
        <a class="text-primary hover:underline" href={resolve('/table/url-state')}>URL State</a>
        puts it in the address bar, so a view can be reloaded, shared and read by the server. What each
        setting does is on
        <a class="text-primary hover:underline" href={resolve('/table/filtering')}
          >Filtering &amp; Search</a
        >
        and
        <a class="text-primary hover:underline" href={resolve('/table/sorting-grouping')}
          >Sorting, Grouping &amp; Summaries</a
        >.
      </p>

      <p class="text-text-secondary text-sm">
        <strong class="text-text-primary">Once the rows are on screen.</strong>
        <a class="text-primary hover:underline" href={resolve('/table/selection')}>Row Selection</a>
        for acting on rows,
        <a class="text-primary hover:underline" href={resolve('/table/custom-cells')}
          >Custom Cells</a
        >
        for rendering them your way,
        <a class="text-primary hover:underline" href={resolve('/table/virtual-scrolling')}
          >Virtual Scrolling</a
        >
        and
        <a class="text-primary hover:underline" href={resolve('/table/sticky-pinning')}
          >Sticky Pinning</a
        > for long lists.
      </p>
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
      language="typescript"
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
