<!--
  Table-Playground — herausgelöst aus `+page.svelte`, damit ihn zwei Seiten
  zeigen können: die Doku-Seite und der Landing-Hero. Siehe
  `$lib/playground-host.ts`.

  Die Control-Werte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt.

  `codeSetup` macht aus dem Schnipsel eine vollständige Datei: Eine Tabelle ohne
  `columns` und `items` ist kein Beispiel, sondern ein Tag. Die Daten gehen als
  *dieselben Objekte* hinein, die die Vorschau rendert — der Quelltext kann
  deshalb nicht von dem abweichen, was darüber steht.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { Table, type Column } from '@urbicon-ui/table';
  import { componentData } from './api';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  type Employee = {
    id: number;
    name: string;
    role: string;
    department: string;
    location: string;
  };

  // Die Namen hier sind die Namen im Schnipsel — `codeSetup.consts` druckt sie
  // wörtlich, also heißen sie so, wie ein Konsument sie schreiben würde.
  const columns: Column<Employee>[] = [
    { accessor: 'name', title: 'Name', sortable: true, searchable: true },
    { accessor: 'role', title: 'Role', sortable: true, searchable: true },
    { accessor: 'department', title: 'Department', sortable: true, groupable: true },
    { accessor: 'location', title: 'Location', sortable: true }
  ];

  const items: Employee[] = [
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
    { id: 4, name: 'James Park', role: 'Frontend Dev', department: 'Product', location: 'Remote' },
    { id: 5, name: 'Aisha Patel', role: 'Data Scientist', department: 'Data', location: 'Berlin' },
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
    { id: 8, name: 'Lucas Weber', role: 'Backend Dev', department: 'Product', location: 'Berlin' }
  ];

  const controls = deriveControls(componentData, {
    pick: [
      'variant',
      'size',
      'selectionMode',
      'itemsPerPage',
      'enableSmartFilter',
      'searchPlaceholder'
    ],
    overrides: {
      // Grenzen und Startwert sind eine Playground-Entscheidung; die Komponente
      // selbst hat nur einen Default (10), keinen erlaubten Bereich.
      itemsPerPage: { label: 'Items per page', min: 3, max: 20, step: 1, defaultValue: 5 },
      enableSmartFilter: { label: 'Smart Filter' },
      searchPlaceholder: { label: 'Search Placeholder', defaultValue: 'Search team...' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="Table"
  {propDocs}
  {variantKeys}
  {size}
  {showHeader}
  {slotClasses}
  class={className}
  {controls}
  values={defaultValuesOf(controls)}
  codeSetup={{
    imports: [
      "import { Table } from '@urbicon-ui/table';",
      "import '@urbicon-ui/table/style/index.css';"
    ],
    consts: { columns, items },
    bind: ['columns', 'items']
  }}
>
  {#snippet children(values)}
    <Table
      variant={values.variant}
      size={values.size}
      selectionMode={values.selectionMode}
      itemsPerPage={values.itemsPerPage}
      enableSmartFilter={values.enableSmartFilter}
      searchPlaceholder={values.searchPlaceholder}
      {columns}
      {items}
    />
  {/snippet}
</PlaygroundConfigurator>
