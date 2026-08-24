<script lang="ts">
  import type { Column } from '$lib/types/tableTypes';
  import Table from '$lib/core/table/Table.svelte';
  import ColumnVisibilityPanel from '../ColumnVisibilityPanel.svelte';
  import FilterPanel from '../FilterPanel.svelte';
  import GroupingPanel from '../GroupingPanel.svelte';
  import SmartFilterBar from '../SmartFilterBar.svelte';
  import SortPanel from '../SortPanel.svelte';
  import SummaryPanel from '../SummaryPanel.svelte';

  /**
   * Both tool geometries of one table at once: the wide bar's five menus, and
   * the four sheet panels that replace them on a narrow one.
   *
   * They never coexist in production — the bar swaps one for the other at its
   * `@md` container step. Here they do, because the alternative is worse: the
   * swap is driven by a custom property read off `getComputedStyle`, and jsdom
   * resolves no cascade at all, so the compact branch is unreachable from a
   * DOM test. Mounting the panels bare is exactly what their own contract
   * allows — each is documented "hull-free", the body of a popover on one bar
   * and a sheet section on the other, with no geometry of its own.
   *
   * Every panel goes in its own testid box: SortPanel and GroupingPanel both
   * label their radio group "Column" (the section heading names the tool), so
   * an unscoped role query cannot tell them apart. The same holds for the
   * empty-state note (#254), which is one sentence per axis in five sections.
   */
  let { items = [] as Record<string, unknown>[], columns = [] as Column[], ...rest } = $props();
</script>

<Table {items} {columns} ariaLabel="Test table" {...rest}>
  {#snippet toolbar()}
    <SmartFilterBar />
    <div data-testid="sheet-filter"><FilterPanel surface="sheet" /></div>
    <div data-testid="sheet-sort"><SortPanel /></div>
    <div data-testid="sheet-grouping"><GroupingPanel /></div>
    <div data-testid="sheet-summary"><SummaryPanel /></div>
    <div data-testid="sheet-columns"><ColumnVisibilityPanel /></div>
  {/snippet}
</Table>
