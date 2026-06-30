<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import {
    Button,
    Select,
    Tooltip,
    resolveIcon,
    ArrowUpDownIcon as ArrowUpDownIconDefault
  } from '@urbicon-ui/blocks';

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

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <Tooltip label={tt('sort.button')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={isActive}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      disabled={sortableColumns.length === 0}
      onclick={() => (menuOpen = !menuOpen)}
    >
      <ArrowUpDownIcon class="h-4 w-4" />
    </Button>
  </Tooltip>
{/snippet}

<Select
  options={sortOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  disabled={sortableColumns.length === 0}
  size="sm"
  syncWidth={false}
  {customTrigger}
/>
