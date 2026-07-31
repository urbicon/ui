<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { smartFilterBarTriggerVariants } from '$lib/variants';
  import {
    Button,
    Select,
    Tooltip,
    resolveIcon,
    LayersIcon as LayersIconDefault
  } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  const LayersIcon = resolveIcon('layers', LayersIconDefault);

  const tableContext = getTableContext();
  const { state: tableState, setGroupByKey } = tableContext;

  const currentValue = $derived(tableState.groupByKey || '');
  const isActive = $derived(!!currentValue);

  // The check glyph that used to sit next to the icon is gone: it was a third
  // way of saying "on" in a bar that also had counters and nothing at all.
  // Grouping is single-level in the store, so there is no count to show either —
  // the group-tinted ground says it, in the same teal as the chip below the bar.
  const triggerClass = $derived(
    isActive ? smartFilterBarTriggerVariants({ intent: 'group' }) : undefined
  );

  const groupableColumns = $derived.by(() => {
    return tableState.columns.filter((col) => {
      // Synthetic columns have no accessor and structurally lack the
      // derivable flags — exclude before reading them.
      if (col.accessor === undefined) return false;
      if (col.groupable !== undefined) return col.groupable === true;
      // Derived from what the column declares, not from what it is called. This
      // read `id !== 'actions' && !id.includes('action')` until 2026-07-31 —
      // the same name-guessing as the summary heuristic, and equally wrong in
      // both directions: a legitimate `transaction` or `actionType` column was
      // silently ungroupable, while the synthetic-column check above already
      // covers the case the name was standing in for.
      return col.sortable === true;
    });
  });

  const groupingOptions = $derived.by(() => {
    const options = [{ label: tt('grouping.none'), value: '' }];

    groupableColumns.forEach((column) => {
      options.push({
        label: resolveColumnLabel(column),
        value: resolveColumnId(column)
      });
    });

    // Grouping is a superset of this menu: `initialGroupBy` / `setGroupByKey`
    // accept any item field, so a table can legitimately group by something it
    // shows no column for (the landing journey groups bookings by `day` while
    // displaying no Day column). Without this the Select holds a value with no
    // matching option — DEV-logs `[Select] value "day" has no matching option`,
    // cannot display the active grouping, and once a user ungroups there is no
    // way back to it.
    //
    // Appending it keeps the menu a faithful view of the state rather than
    // making the menu the authority over it. The label falls back to the raw key
    // because that is genuinely all we know about a field with no column.
    const active = tableState.groupByKey;
    if (active && !options.some((o) => o.value === active)) {
      options.push({ label: active, value: active });
    }

    return options;
  });

  let menuOpen = $state(false);

  function handleValueChange(value: string) {
    setGroupByKey(value === '' ? null : value);
  }
</script>

{#snippet customTrigger(_selected: unknown[], _open: boolean, _clear: () => void)}
  <Tooltip label={tt('grouping.button')}>
    <Button
      variant="ghost"
      intent="neutral"
      size="sm"
      active={isActive}
      class={triggerClass}
      aria-expanded={menuOpen}
      aria-haspopup="listbox"
      onclick={() => (menuOpen = !menuOpen)}
    >
      <LayersIcon class="h-4 w-4" />
    </Button>
  </Tooltip>
{/snippet}

<!-- `w-auto`: see SortMenu — the Select wrapper defaults to `w-full`. -->
<Select
  options={groupingOptions}
  value={currentValue}
  bind:open={menuOpen}
  onValueChange={(v: string | null) => handleValueChange(v ?? '')}
  size="sm"
  syncWidth={false}
  class="w-auto"
  {customTrigger}
/>
