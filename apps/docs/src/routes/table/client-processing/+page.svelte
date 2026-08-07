<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import {
    CodeExample,
    DocsLayout as DocsPageLayout,
    Note,
    NoteList,
    Section
  } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { resolve } from '$app/paths';
  import { type Employee, employees, scriptClose } from '../_data';

  // `<script lang="ts">` as an opener is safe inside a template literal (the
  // parser only looks for the closing tag); the closer comes from `_data`.
  const scriptOpenTs = '<' + 'script lang="ts">';

  // Display-only specifier. Interpolated so vite's dep-scanner — which
  // regex-extracts imports from the raw script of a lang="ts" svelte file —
  // does not try to resolve a path that only exists in the reader's project.
  const columnsPath = `'./columns'`;
  const dataPath = `'./data'`;

  const navigation = [
    { id: 'rows', title: 'Hand over the rows' },
    { id: 'fetching', title: 'While the rows are loading' },
    { id: 'handover', title: 'When the browser runs out' }
  ];

  // The very columns the example below renders — one declaration, so the
  // snippet and the live table cannot drift apart.
  const demoColumns: Column<Employee>[] = [
    { accessor: 'name', title: 'Employee', sortable: true, searchable: true },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    { accessor: 'location', title: 'Location', sortable: true }
  ];

  const codeItems = `${scriptOpenTs}
  import { Table } from '@urbicon-ui/table';
  import { employees } from ${dataPath};

  const columns = [
    { accessor: 'name', title: 'Employee', sortable: true, searchable: true },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    { accessor: 'location', title: 'Location', sortable: true }
  ];
${scriptClose}

<Table {columns} items={employees} viewDefaults={{ pageSize: 5 }} />`;

  const codeLoad = `// +page.server.ts
export const load = async () => ({ employees: await db.employees.findMany() });

// +page.svelte
${scriptOpenTs}
  import { Table } from '@urbicon-ui/table';
  import { columns } from ${columnsPath};

  let { data } = $props();
${scriptClose}

<Table {columns} items={data.employees} />`;

  const codeStates = `${scriptOpenTs}
  import { Table } from '@urbicon-ui/table';

  let items = $state<Employee[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  fetchEmployees()
    .then((rows) => (items = rows))
    .catch((e) => (error = e.message))
    .finally(() => (loading = false));
${scriptClose}

<Table {columns} source={{ processing: 'client', items, loading, error }} />`;
</script>

<SeoMeta
  title="Client Processing - Table"
  description="The table sorts, filters, searches and pages your rows in the browser. Pass an array, and every control on the page works."
/>

<DocsPageLayout
  title="Client Processing"
  description="The table sorts, filters, searches and pages your rows in the browser. Pass an array, and every control on the page works."
  {navigation}
  showToc={true}
  breadcrumbs={[{ label: 'Table', href: resolve('/table/table') }]}
>
  <Section id="rows" title="Hand over the rows">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        <code class="text-text-primary">processing: 'client'</code> means the table does the work.
        Search, filters, sorting, grouping and paging all happen in the browser, on the array you
        passed. The <code class="text-text-primary">items</code> prop is the short way to say it:
      </p>

      <CodeExample
        title="An array and some columns"
        description="Type in the search field, click a header, page through. Nothing else to wire."
        code={codeItems}
      >
        <Table columns={demoColumns} items={employees} viewDefaults={{ pageSize: 5 }} />
      </CodeExample>

      <p class="text-text-secondary text-sm">
        You don't need <code class="text-text-primary">source</code> for this. Reach for it once a loading
        or an error state comes into it.
      </p>

      <p class="text-text-secondary text-sm">
        Rows that arrive with the page are the same case. A SvelteKit
        <code class="text-text-primary">load</code> has them ready before the page renders, so the first
        screen is server-rendered and the table takes over from there:
      </p>

      <CodeExample
        title="Rows from a SvelteKit load"
        description="No fetch in the browser, no empty first paint."
        code={codeLoad}
        preview={false}
      />
    </div>
  </Section>

  <Section id="fetching" title="While the rows are loading">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        When you fetch the rows yourself, <code class="text-text-primary">source</code> carries the two
        states the table renders for you:
      </p>

      <CodeExample title="Your fetch, the table's states" code={codeStates} preview={false} />

      <p class="text-text-secondary text-sm">
        The table shows its loading row while <code class="text-text-primary">loading</code> is
        true, and its error state with whatever <code class="text-text-primary">error</code> holds as
        the message. You decide when each applies. The rows keep being sorted, filtered and paged in the
        browser throughout.
      </p>

      <NoteList variant="flush">
        <Note title="source wins over items">
          Both props reach the same rows. When you pass both, the table reads
          <code>source</code> and the <code>items</code> prop does nothing.
        </Note>
      </NoteList>
    </div>
  </Section>

  <Section id="handover" title="When the browser runs out">
    <div class="space-y-4">
      <p class="text-text-secondary text-sm">
        The whole set sits in memory, and every sort touches all of it. A few thousand rows is
        comfortable. A hundred thousand is a tab that stops responding.
      </p>

      <p class="text-text-secondary text-sm">
        Two ways out, and they answer different questions. If the rows still fit and only the
        rendering hurts, keep client processing and draw fewer of them:
        <a class="text-primary hover:underline" href={resolve('/table/virtual-scrolling')}
          >Virtual Scrolling</a
        >. If the set is too large to send at all, the backend sorts and pages it instead:
        <a class="text-primary hover:underline" href={resolve('/table/server-processing')}
          >Server Processing</a
        >.
      </p>
    </div>
  </Section>
</DocsPageLayout>
