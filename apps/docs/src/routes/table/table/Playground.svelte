<!--
  Table playground — split out of `+page.svelte` so that two pages can show it:
  the docs page and the landing hero. See `$lib/playground-host.ts`.

  The control values come from the generated API (`deriveControls`); only what
  cannot be derived is written out by hand here.

  `codeSetup` turns the snippet into a complete file: a table without `columns`
  and `items` is not an example, it is a tag. The data goes in as the *same
  objects* the preview renders, so the source text cannot say anything other
  than what stands above it.

  The page size runs through a view object of its own rather than through
  `viewDefaults`: defaults are resolved once, at construction, so a control on
  them did not move the preview. `bind:values` closes the loop back to the
  snippet: the printed `createTableView` call shows the number that is set right
  now.
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

  // The names here are the names in the snippet: `codeSetup.consts` prints them
  // verbatim, so they read the way a consumer would write them.
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

  // The control's starting value AND the view's default: one number, not a pair
  // that can drift apart.
  const PAGE_SIZE = 5;

  const controls = deriveControls(componentData, {
    pick: [
      'variant',
      'size',
      'selectionMode',
      'enableSmartFilter',
      'searchPlaceholder',
      'cardsBelow'
    ],
    overrides: {
      enableSmartFilter: { label: 'Smart Filter' },
      searchPlaceholder: { label: 'Search Placeholder', defaultValue: 'Search team...' },
      // Measured on the docs page: the column this playground sits in is 608px
      // wide at a 1280px viewport and 768px at 1440px. At the library default
      // (48rem = 768px) the one demo that has to show a table showed a card
      // list on every laptop below 1440px. Four columns read fine far below
      // that (the prop's own guidance is about 29rem for a four-column index),
      // so the demo starts one step above it and the control walks the reader
      // across the switch in both directions.
      cardsBelow: { defaultValue: '32rem' }
    },
    extra: [
      {
        // The page size is not a prop any more but an axis of the view, hence
        // `extra` (the control drives the demo, not an attribute) and hence it
        // writes to `view.pageSize` below. `at: 3` holds it in its place in the
        // control strip. The bounds are a playground decision; the axis itself
        // only has a default (10).
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

  // The view belongs to the playground: that is the only way the control has an
  // effect. `viewDefaults` resolves once, at construction, and a later change of
  // that prop is ignored.
  const view = createTableView({ defaults: { pageSize: PAGE_SIZE } });

  // A direct field write does not reset the page (only the table's own handlers
  // do that). No consequence here: the rendered page is clamped into the valid
  // range anyway.
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
      // Raw, because a constructed view has no printable value form, and with
      // the *current* control setting in it, or the snippet would show a
      // different table than the stage above it.
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
      cardsBelow={values.cardsBelow}
      {columns}
      {items}
      {view}
    />
  {/snippet}
</PlaygroundConfigurator>
