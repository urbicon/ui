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

  Die Seitengröße läuft über ein eigenes View-Objekt statt über `viewDefaults`:
  Defaults werden einmal bei Konstruktion aufgelöst, ein Regler daran bewegte
  die Vorschau nicht. `bind:values` schließt den Kreis zum Schnipsel — der
  gedruckte `createTableView`-Aufruf zeigt die Zahl, die gerade eingestellt ist.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { createTableView, Table, type Column } from '@urbicon-ui/table';
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

  // Startwert des Reglers UND Default des Views — eine Zahl, kein Paar, das
  // auseinanderlaufen kann.
  const PAGE_SIZE = 5;

  const controls = deriveControls(componentData, {
    pick: ['variant', 'size', 'selectionMode', 'enableSmartFilter', 'searchPlaceholder'],
    overrides: {
      enableSmartFilter: { label: 'Smart Filter' },
      searchPlaceholder: { label: 'Search Placeholder', defaultValue: 'Search team...' }
    },
    extra: [
      {
        // Die Seitengröße ist keine Prop mehr, sondern eine Achse des Views —
        // deshalb `extra` (der Regler steuert die Demo, nicht ein Attribut) und
        // deshalb schreibt er unten auf `view.pageSize`. `at: 3` hält ihn an
        // seinem Platz im Reglerstreifen. Grenzen sind eine
        // Playground-Entscheidung; die Achse selbst hat nur einen Default (10).
        type: 'number',
        key: 'pageSize',
        label: 'Items per page',
        min: 3,
        max: 20,
        step: 1,
        defaultValue: PAGE_SIZE,
        at: 3
      }
    ]
  });

  let values = $state<Record<string, unknown>>(defaultValuesOf(controls));
  const pageSize = $derived((values.pageSize as number | undefined) ?? PAGE_SIZE);

  // Das View gehört dem Playground — nur so wirkt der Regler. `viewDefaults`
  // löst einmal bei Konstruktion auf, eine spätere Prop-Änderung nicht.
  const view = createTableView({ defaults: { pageSize: PAGE_SIZE } });

  // Ein direkter Feldschreiber setzt die Seite nicht zurück (das tun nur die
  // Handler der Tabelle) — hier folgenlos: die gerenderte Seite wird ohnehin in
  // den gültigen Bereich geklemmt.
  $effect(() => {
    view.pageSize = pageSize;
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
  bind:values
  codeSetup={{
    imports: [
      "import { createTableView, Table } from '@urbicon-ui/table';",
      "import '@urbicon-ui/table/style/index.css';"
    ],
    consts: {
      columns,
      items,
      // Roh, weil ein konstruiertes View keine druckbare Wertform hat — und mit
      // der *aktuellen* Reglerstellung darin, sonst zeigte der Schnipsel eine
      // andere Tabelle als die Bühne darüber.
      view: { raw: `createTableView({ defaults: { pageSize: ${pageSize} } })` }
    },
    bind: ['columns', 'items', 'view']
  }}
>
  {#snippet children(values)}
    <Table
      variant={values.variant}
      size={values.size}
      selectionMode={values.selectionMode}
      enableSmartFilter={values.enableSmartFilter}
      searchPlaceholder={values.searchPlaceholder}
      {columns}
      {items}
      {view}
    />
  {/snippet}
</PlaygroundConfigurator>
