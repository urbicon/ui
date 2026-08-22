<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { isColumnSummable } from '$lib/utils/column-capabilities';
  import { isSummaryType, SUMMARY_TYPES } from '$lib/utils/summary-types';
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

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why.
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

  // The guard instead of a cast: the radio values come from the vocabulary
  // module, but the store must not have to trust that — anything outside the
  // union (including the '' of the "none" row) reads as "no aggregation".
  function handleChange(columnId: string, type: string) {
    if (!isSummaryType(type)) {
      removeSummaryConfig(columnId);
      return;
    }
    addSummaryConfig({ column: columnId, type });
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
          <RadioItem value={type.value} label={tt(type.labelKey)} />
        {/each}
      </RadioGroup>
    {/each}
  </div>
{/if}
