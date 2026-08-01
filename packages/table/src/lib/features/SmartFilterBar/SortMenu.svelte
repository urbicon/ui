<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Select,
    resolveIcon,
    ArrowUpDownIcon as ArrowUpDownIconDefault
  } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';

  /** Full-width labelled row instead of a tooltipped icon — see MenuTrigger. */
  let { stacked = false }: { stacked?: boolean } = $props();

  const tt = useTableI18n();

  const ArrowUpDownIcon = resolveIcon('arrowUpDown', ArrowUpDownIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, setSort } = tableContext;

  // Sorting is otherwise only reachable by clicking a column header, which the
  // mobile card layout has no equivalent of — this exposes it in the toolbar.
  const sortableColumns = $derived.by(() =>
    tableState.columns.filter((col) => {
      // Synthetic columns have no accessor — sorting by them is undefined.
      if (col.accessor === undefined) return false;
      return col.sortable === undefined || col.sortable === true;
    })
  );

  const isActive = $derived(!!tableState.sortColumn);

  // No counter beside the icon: the store holds ONE sort column, so any number
  // rendered here would forever read "1". The lit ground is the whole signal —
  // `primary`, the tint the sorted column header carries in the grid itself.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'primary' }) : undefined
  );

  // Encode the active sort as `${columnId}:${direction}` so the column and the
  // direction can travel through the single-value Select; '' means unsorted.
  const currentValue = $derived(
    tableState.sortColumn ? `${tableState.sortColumn}:${tableState.sortDirection}` : ''
  );

  const sortOptions = $derived.by(() => {
    const options: { label: string; value: string }[] = [{ label: tt('sort.none'), value: '' }];
    for (const column of sortableColumns) {
      const id = resolveColumnId(column);
      const label = resolveColumnLabel(column);
      options.push({ label: `${label} · ${tt('sort.ascending')}`, value: `${id}:asc` });
      options.push({ label: `${label} · ${tt('sort.descending')}`, value: `${id}:desc` });
    }
    return options;
  });

  let menuOpen = $state(false);

  function handleValueChange(value: string) {
    if (!value) {
      setSort('', 'asc');
      return;
    }
    const [columnId, direction] = value.split(':');
    if (columnId && (direction === 'asc' || direction === 'desc')) {
      setSort(columnId, direction);
    }
  }
</script>

{#snippet triggerIcon()}
  <ArrowUpDownIcon class="h-4 w-4" />
{/snippet}

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <MenuTrigger
    label={tt('sort.button')}
    {stacked}
    active={isActive}
    {triggerClass}
    expanded={menuOpen}
    disabled={sortableColumns.length === 0}
    icon={triggerIcon}
    onclick={() => (menuOpen = !menuOpen)}
  />
{/snippet}

<!--
  `w-auto` on the Select wrapper: its default `w-full` makes the wrapper a
  stretching flex item in the toolbar row, which padded every menu trigger with
  dead space and left the icons unevenly spaced.
-->
<!--
  `usePortal={!stacked}`: stacked means this Select lives inside the tool
  popover, and Popover's own contract (see Popover.svelte) puts a nested panel on
  `position: absolute` instead of promoting a second top layer — that is where
  the focus and z-index quirks live. FilterMenu's operator Select already does it.
-->
<Select
  options={sortOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  disabled={sortableColumns.length === 0}
  size="sm"
  syncWidth={false}
  usePortal={!stacked}
  class="w-auto"
  {customTrigger}
/>
