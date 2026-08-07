<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Select,
    resolveIcon,
    ArrowUpDownIcon as ArrowUpDownIconDefault
  } from '@urbicon-ui/blocks';
  import MenuTrigger from './MenuTrigger.svelte';
  import { buildSortEntries } from './tool-columns';

  /**
   * The wide bar's sort tool. Sorting is otherwise only reachable by clicking a
   * column header; the narrow bar reaches it through SortPanel instead, which
   * splits the same choice into column and direction (see there for why).
   */
  const tt = useTableI18n();

  const ArrowUpDownIcon = resolveIcon('arrowUpDown', ArrowUpDownIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, view: tableView, setSort } = tableContext;

  const entries = $derived(buildSortEntries(tableState.columns));

  const isActive = $derived(tableView.sort !== null);

  // No counter beside the icon: the store holds ONE sort column, so any number
  // rendered here would forever read "1". The lit ground is the whole signal —
  // `primary`, the tint the sorted column header carries in the grid itself.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'primary' }) : undefined
  );

  // Encode the active sort as `${columnId}:${direction}` so the column and the
  // direction can travel through the single-value Select; '' means unsorted.
  const currentValue = $derived(
    tableView.sort ? `${tableView.sort.column}:${tableView.sort.direction}` : ''
  );

  const sortOptions = $derived.by(() => {
    const options: { label: string; value: string }[] = [{ label: tt('sort.none'), value: '' }];
    for (const entry of entries) {
      options.push({ label: `${entry.label} · ${tt('sort.ascending')}`, value: `${entry.id}:asc` });
      options.push({
        label: `${entry.label} · ${tt('sort.descending')}`,
        value: `${entry.id}:desc`
      });
    }
    return options;
  });

  let menuOpen = $state(false);

  function handleValueChange(value: string) {
    if (!value) {
      setSort(null);
      return;
    }
    const [columnId, direction] = value.split(':');
    if (columnId && (direction === 'asc' || direction === 'desc')) {
      setSort({ column: columnId, direction });
    }
  }
</script>

{#snippet triggerIcon()}
  <ArrowUpDownIcon class="h-4 w-4" />
{/snippet}

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <MenuTrigger
    label={tt('sort.button')}
    active={isActive}
    {triggerClass}
    expanded={menuOpen}
    disabled={entries.length === 0}
    icon={triggerIcon}
    onclick={() => (menuOpen = !menuOpen)}
  />
{/snippet}

<!--
  `w-auto` on the Select wrapper: its default `w-full` makes the wrapper a
  stretching flex item in the toolbar row, which padded every menu trigger with
  dead space and left the icons unevenly spaced.
-->
<Select
  options={sortOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  disabled={entries.length === 0}
  size="sm"
  syncWidth={false}
  class="w-auto"
  {customTrigger}
/>
