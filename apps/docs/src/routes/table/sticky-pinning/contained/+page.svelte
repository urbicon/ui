<script lang="ts">
  import SeoMeta from '$lib/SeoMeta.svelte';
  import { Table } from '@urbicon-ui/table';
  import { SegmentGroup, SegmentItem } from '@urbicon-ui/blocks';
  import { resolve } from '$app/paths';
  import { employees, richColumns } from '../../_data';

  /**
   * The live `fit="viewport"` demo, on a page of its own — and it has to be a
   * page of its own.
   *
   * The contained model caps the table at `100dvh - --blocks-table-avail-top`,
   * where that offset is how much viewport sits above the container. It is
   * measured on resize and on reflow, deliberately never on page scroll (the
   * property drives the container's own height, so re-measuring on scroll would
   * close the loop), which is the same as saying the model assumes the table IS
   * the page.
   *
   * Measured inline in the article column of /table/sticky-pinning: the first
   * reading is discarded for being below the viewport bottom, so the box takes
   * the full window height (800px) inside a 624px reading column, and a later
   * resize caps it to the room left at that scroll position (480px at
   * scrollY 6100) and keeps that number. So an inline demo there shows a box
   * with no relation to the space it has; only a page whose main content is the
   * table can show the model. /table/sticky-pinning frames this one.
   *
   * The chrome (no docs sidebar, an app-shell bar of its own) is not decoration:
   * the bar is what `--blocks-table-avail-top` measures, so the reader sees the
   * offset the cap subtracts.
   */

  let fit = $state<'viewport' | 'content'>('viewport');

  // 130 deterministic rows — enough that the box has to scroll at any window
  // height. Cohort suffix so a reader can tell repeated people apart; the id
  // offset keeps the keys unique.
  //
  // Grouped, so both layers the contained model pins are on screen at once: the
  // column header and the group header below it. (The toolbar is not pinned
  // here — it stays put by sitting outside the scroll box.) A grouped table
  // shows its whole set, which is why there is no page size.
  const rows = Array.from({ length: 10 }, (_, cohort) =>
    employees.map((employee) => ({
      ...employee,
      id: employee.id + cohort * 100,
      name: cohort === 0 ? employee.name : `${employee.name} ${cohort + 1}`
    }))
  ).flat();
</script>

<SeoMeta
  title={'Contained scroll demo — fit="viewport"'}
  description="A full-height list page: the table is capped to the viewport, its header and group headers pin to the top of the box, and only the rows scroll."
  noindex
/>

<!-- The app-shell bar the contained model is designed to sit under. Whatever
     height it ends up at — it wraps in a narrow frame — is what the table
     measures into --blocks-table-avail-top and subtracts from the cap. -->
<header
  class="border-border-default bg-surface-elevated flex min-h-12 flex-wrap items-center gap-x-4 gap-y-1 border-b px-4 py-2"
>
  <span class="text-text-primary text-sm font-semibold">Employees</span>
  <SegmentGroup bind:value={fit} size="sm" ariaLabel="fit">
    <SegmentItem value="viewport" data-testid="fit-viewport">viewport</SegmentItem>
    <SegmentItem value="content" data-testid="fit-content">content</SegmentItem>
  </SegmentGroup>
  <a
    href={resolve('/table/sticky-pinning')}
    class="text-text-tertiary hover:text-text-primary ml-auto text-xs whitespace-nowrap transition-colors"
    >Sticky Pinning docs</a
  >
</header>

<!-- No padding at the bottom: a contained box reaches the bottom edge of the
     viewport, and an inset below it is what produces the second scrollbar the
     page's caveats warn about. -->
<main id="main-content" class="px-4 pt-4">
  <Table
    {fit}
    items={rows}
    columns={richColumns}
    cardsBelow="32rem"
    variant="framed"
    ariaLabel="Employees"
    searchPlaceholder="Search employees…"
    viewDefaults={{ groupBy: 'department' }}
  />
</main>
