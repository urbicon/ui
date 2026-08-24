<script lang="ts">
  import { getTableContext, useTableI18n } from '$lib';
  import { isSummaryType, SUMMARY_TYPES } from '$lib/utils/summary-types';
  import { RadioGroup, RadioItem } from '@urbicon-ui/blocks';
  import { buildSummaryEntries, toolColumnScope } from './tool-columns';

  /**
   * One aggregation choice per summable column.
   *
   * This is the store's actual shape, not a redesign: `addSummaryConfig`
   * replaces by column (`findIndex(c => c.column === config.column)`), so a
   * column carries at most one aggregation. Every column is a radio row,
   * which can only mean what it does — and turning one off is a choice
   * ("none") rather than a hunt for the chip. The wide bar's SummaryMenu
   * phrases the same six states as `menuitemradio` groups per column; this
   * panel was the first surface to show the store honestly, and the menu
   * followed.
   */
  const tt = useTableI18n();

  const tableContext = getTableContext();
  const { state: tableState, addSummaryConfig, removeSummaryConfig } = tableContext;

  // Capability follows configuration, never the column's name — see
  // utils/column-capabilities.ts for what that replaced and why. Columns
  // already carrying a configuration stay listed even once hidden (#253),
  // which is what keeps an aggregation editable after its column leaves the
  // grid.
  //
  // `state.summaryConfigs`, not the effective list: a radio's value is what the
  // column is CONFIGURED to aggregate, and that survives `toggleSummary()`
  // hiding the row — the sheet's own summary badge, which counts what is
  // acting, is the surface that goes quiet there (#252, see HeaderMenu for the
  // full decision).
  const rows = $derived(
    buildSummaryEntries(
      toolColumnScope(tableState),
      tableState.summaryConfigs.map((config) => config.column)
    ).map((entry) => ({
      id: entry.id,
      label: entry.label,
      current: tableState.summaryConfigs.find((config) => config.column === entry.id)?.type ?? ''
    }))
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
