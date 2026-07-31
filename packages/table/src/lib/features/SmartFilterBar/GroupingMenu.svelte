<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import {
    findColumnById,
    humanizeColumnId,
    resolveColumnId,
    resolveColumnLabel
  } from '$lib/utils';
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
    // shows no column for — the landing journey groups bookings by `day` while
    // displaying no Day column, because the day belongs in the group header and
    // would be redundant in every row.
    //
    // Two keys can therefore be missing from the list above, and they need
    // different treatment:
    //
    //   • the DECLARED key (`initialGroupBy`). The consumer asked for this
    //     grouping, so it belongs in the menu permanently — including after the
    //     user ungroups, which is the whole point. Deriving it from the *active*
    //     key instead would make the option vanish on ungroup, i.e. leave the
    //     reported symptom ("no way back to it") exactly as it was.
    //
    //   • the ACTIVE key, when it is neither a listed column nor the declared
    //     one — reachable through a programmatic `setGroupByKey`, or through a
    //     column the header menu offers but this list filters out (`groupable`
    //     unset, `sortable` not true). Without it the Select holds a value it
    //     cannot display and DEV-logs `value "…" has no matching option`.
    //
    // Labels go through `humanizeColumnId`, the same helper the rest of the
    // package uses, so the option reads "Day" rather than the raw field name —
    // and matches the grouping chip, which resolves its label the same way.
    for (const key of [tableState.declaredGroupByKey, tableState.groupByKey]) {
      if (!key || options.some((o) => o.value === key)) continue;
      const column = findColumnById(tableState.columns, key);
      options.push({
        label: column ? resolveColumnLabel(column) : humanizeColumnId(key),
        value: key
      });
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
