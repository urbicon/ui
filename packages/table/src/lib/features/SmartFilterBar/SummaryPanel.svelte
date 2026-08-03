<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { isColumnSummable } from '$lib/utils/summable';
  import { resolveColumnId, resolveColumnLabel } from '$lib/utils';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';

  /**
   * One aggregation choice per summable column.
   *
   * This is the store's actual shape, not a redesign: `addSummaryConfig`
   * replaces by column (`findIndex(c => c.column === config.column)`), so a
   * column carries at most one aggregation. The wide bar's SummaryMenu hides
   * that behind an additive-looking "pick a column·type to add" list, where
   * choosing a second type for the same column silently replaces the first.
   * Here every column is a radio row, which can only mean what it does — and
   * turning one off is a choice ("none") rather than a hunt for the chip.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  const SUMMARY_TYPES = [
    { value: 'sum', label: () => tt('summary.types.sum') },
    { value: 'avg', label: () => tt('summary.types.average') },
    { value: 'count', label: () => tt('summary.types.count') },
    { value: 'min', label: () => tt('summary.types.minimum') },
    { value: 'max', label: () => tt('summary.types.maximum') }
  ] as const;

  // Capability follows configuration, never the column's name — see
  // utils/summable.ts for what that replaced and why.
  const summableColumns = $derived(tableState.columns.filter(isColumnSummable));

  const rows = $derived(
    summableColumns.map((column) => {
      const id = resolveColumnId(column);
      return {
        id,
        label: resolveColumnLabel(column),
        current: tableState.summaryConfigs.find((config) => config.column === id)?.type ?? ''
      };
    })
  );

  function handleChange(columnId: string, type: string) {
    if (!type) {
      removeSummaryConfig(columnId);
      return;
    }
    addSummaryConfig({ column: columnId, type: type as (typeof SUMMARY_TYPES)[number]['value'] });
  }
</script>

{#if rows.length === 0}
  <p class="text-text-secondary text-sm">{tt('summary.empty')}</p>
{:else}
  <div class="space-y-4">
    {#each rows as row (row.id)}
      <RadioGroup
        value={row.current}
        onValueChange={(type: string) => handleChange(row.id, type)}
        label={row.label}
        orientation="horizontal"
        size="sm"
      >
        <RadioItem value="" label={tt('summary.none')} />
        {#each SUMMARY_TYPES as type (type.value)}
          <RadioItem value={type.value} label={type.label()} />
        {/each}
      </RadioGroup>
    {/each}
  </div>
{/if}
