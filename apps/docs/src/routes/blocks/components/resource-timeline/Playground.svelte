<!--
  ResourceTimeline-Playground — eigene Datei wie bei Planner/Calendar, damit die
  Doku-Seite und ein möglicher Hero-Host denselben Stand zeigen. Siehe
  `$lib/playground-host.ts`.

  Die Knopfwerte kommen aus der generierten API (`deriveControls`); von Hand
  steht hier nur, was sich nicht ableiten lässt — die `days`-Bedingung und die
  Demodaten.
-->
<script lang="ts">
  import type { PlaygroundHostProps } from '$lib/playground-host';
  import { ResourceTimeline } from '@urbicon-ui/blocks';
  import { addDays, isoToDate } from '@urbicon-ui/blocks/date';
  import {
    defaultValuesOf,
    deriveControls,
    extractPlaygroundDocs,
    PlaygroundConfigurator
  } from '@urbicon-ui/docs';
  import { componentData } from './api';
  import playgroundSource from './Playground.svelte?raw';

  let { size, showHeader = false, slotClasses, class: className }: PlaygroundHostProps = $props();

  const { propDocs, variantKeys } = extractPlaygroundDocs(componentData?.props ?? []);

  interface Booking {
    id: string;
    roomId: string;
    guest: string;
    checkIn: string;
    checkOut: string;
    state: 'confirmed' | 'option';
  }

  const groups = [
    { id: 'cala', label: 'Cala · Menorca' },
    { id: 'firn', label: 'Firn · Engadin' }
  ];

  const resources = [
    { id: 'cala-01', label: 'Cala 01', description: 'Garden Room', groupId: 'cala' },
    { id: 'cala-04', label: 'Cala 04', description: 'Room', groupId: 'cala' },
    { id: 'cala-11', label: 'Cala 11', description: 'Suite', groupId: 'cala' },
    { id: 'firn-02', label: 'Firn 02', description: 'Room', groupId: 'firn' },
    { id: 'firn-08', label: 'Firn 08', description: 'Suite', groupId: 'firn' }
  ];

  const categories = [
    { id: 'confirmed', label: 'Confirmed', color: 'oklch(0.62 0.13 250)' },
    { id: 'option', label: 'Option', color: 'oklch(0.83 0.13 90)' }
  ];

  const items: Booking[] = [
    {
      id: 'b1',
      roomId: 'cala-01',
      guest: 'Lindqvist',
      checkIn: '2026-06-12',
      checkOut: '2026-06-18',
      state: 'confirmed'
    },
    {
      id: 'b2',
      roomId: 'cala-01',
      guest: 'Okafor',
      checkIn: '2026-06-20',
      checkOut: '2026-06-26',
      state: 'confirmed'
    },
    {
      id: 'b3',
      roomId: 'cala-04',
      guest: 'Bianchi',
      checkIn: '2026-06-16',
      checkOut: '2026-06-19',
      state: 'option'
    },
    {
      id: 'b4',
      roomId: 'cala-11',
      guest: 'Sørensen',
      checkIn: '2026-06-18',
      checkOut: '2026-06-23',
      state: 'confirmed'
    },
    {
      id: 'b5',
      roomId: 'firn-02',
      guest: 'Weber',
      checkIn: '2026-06-15',
      checkOut: '2026-06-18',
      state: 'confirmed'
    },
    {
      id: 'b6',
      roomId: 'firn-08',
      guest: 'Ferreira',
      checkIn: '2026-06-21',
      checkOut: '2026-06-28',
      state: 'option'
    }
  ];

  const getResourceId = (booking: Booking) => booking.roomId;
  const getCategoryId = (booking: Booking) => booking.state;
  const getLabel = (booking: Booking) => booking.guest;
  // Inclusive: the last night of a stay is check-out minus one day.
  const getRange = (booking: Booking) => ({
    start: booking.checkIn,
    end: addDays(isoToDate(booking.checkOut), -1)
  });

  // The demo pins its window: the bookings are June 2026, so an unanchored grid
  // would open on today and show nothing. `codeSetup` prints the same anchor
  // from this one constant, so the copied snippet lands on the same window.
  //
  // The price is that today is never inside the window, so `highlightToday`
  // moves nothing here. Deriving the fixtures from `new Date()` would fix that
  // and cost more: every doc route is prerendered, so build-day bars would be
  // baked into the HTML and hydration would re-render a different set of keyed
  // `{#each}` blocks. Planner pins its dates for the same reason.
  const anchor = new Date(2026, 5, 15);
  const anchorSource = `new Date(${anchor.getFullYear()}, ${anchor.getMonth()}, ${anchor.getDate()})`;

  const controls = deriveControls(componentData, {
    pick: [
      'view',
      'days',
      'variant',
      'size',
      'highlightToday',
      'highlightWeekend',
      'stickyResourceColumn',
      'showLegend',
      'disabled'
    ],
    overrides: {
      // `days` is the column count of the `days` view and does nothing in
      // `week` — a knob that moves nothing reads as a broken library, so it
      // only appears once the view it belongs to is picked.
      days: { label: 'Days', min: 5, max: 28, condition: { dependsOn: 'view', equals: 'days' } },
      highlightToday: { label: 'Highlight Today' },
      highlightWeekend: { label: 'Highlight Weekend' },
      stickyResourceColumn: { label: 'Sticky Column' },
      showLegend: { label: 'Legend' }
    }
  });
</script>

<PlaygroundConfigurator
  componentName="ResourceTimeline"
  source={playgroundSource}
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
      "import { ResourceTimeline } from '@urbicon-ui/blocks';",
      "import { addDays, isoToDate } from '@urbicon-ui/blocks/date';"
    ],
    consts: {
      value: { raw: anchorSource },
      resources,
      groups,
      categories,
      items,
      getResourceId: { raw: '(booking) => booking.roomId' },
      getCategoryId: { raw: '(booking) => booking.state' },
      getLabel: { raw: '(booking) => booking.guest' },
      getRange: {
        raw: '(booking) => ({ start: booking.checkIn, end: addDays(isoToDate(booking.checkOut), -1) })'
      }
    },
    bind: [
      'value',
      'resources',
      'groups',
      'items',
      'categories',
      'getResourceId',
      'getCategoryId',
      'getLabel',
      'getRange'
    ]
  }}
>
  {#snippet children(values)}
    <div class="w-full">
      <ResourceTimeline
        view={values.view}
        days={values.days}
        variant={values.variant}
        size={values.size}
        highlightToday={values.highlightToday}
        highlightWeekend={values.highlightWeekend}
        stickyResourceColumn={values.stickyResourceColumn}
        showLegend={values.showLegend}
        disabled={values.disabled}
        value={anchor}
        {resources}
        {groups}
        {items}
        {categories}
        {getResourceId}
        {getCategoryId}
        {getLabel}
        {getRange}
      />
    </div>
  {/snippet}
</PlaygroundConfigurator>
