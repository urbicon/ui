<script lang="ts">
  import { getTableContext, type TableAction, useTableI18n } from '$lib';
  import type { SummaryConfig } from '$lib/stores/TableStore.svelte';
  import { findColumnById, resolveColumnLabel } from '$lib/utils';
  import { Badge } from '@urbicon-ui/blocks';

  const tt = useTableI18n();

  interface ChipItem {
    type: TableAction;
    id: string;
    content: string;
    onRemove: () => void;
  }

  let { class: className = '' } = $props();

  const tableContext = getTableContext();
  const { state: tableState, removeFilter, setGroupByKey, removeSummaryConfig } = tableContext;

  function getColumnTitle(id: string): string {
    // Raw-id fallback for persisted state that references a removed column.
    const column = findColumnById(tableState.columns, id);
    return column ? resolveColumnLabel(column) : id;
  }

  // Aggregation codes (avg/min/max) differ from their translation keys
  // (average/minimum/maximum). Map explicitly — interpolating the raw code into
  // `summary.types.${type}` produced missing keys ("summary.types.avg") for
  // avg/min/max. The map is type-checked against the translation keys and the
  // SummaryConfig union, so a drift on either side is now a compile error.
  const SUMMARY_TYPE_KEY = {
    sum: 'summary.types.sum',
    avg: 'summary.types.average',
    count: 'summary.types.count',
    min: 'summary.types.minimum',
    max: 'summary.types.maximum'
  } as const satisfies Record<SummaryConfig['type'], string>;

  function getSummaryLabel(config: SummaryConfig): string {
    const columnTitle = getColumnTitle(config.column);
    const typeLabel = tt(SUMMARY_TYPE_KEY[config.type]);
    return `${typeLabel}: ${columnTitle}`;
  }

  const allChips = $derived.by((): ChipItem[] => {
    const chips: ChipItem[] = [];

    // Filter Chips
    tableState.activeFilters.forEach((filter, index) => {
      chips.push({
        type: 'filter',
        id: `filter-${index}`,
        content: `${getColumnTitle(filter.column)}: ${filter.value}`,
        onRemove: () => removeFilter(index)
      });
    });

    if (tableState.groupByKey) {
      chips.push({
        type: 'group',
        id: 'group',
        content: getColumnTitle(tableState.groupByKey),
        onRemove: () => setGroupByKey(null)
      });
    }

    tableState.summaryConfigs.forEach((config, index) => {
      chips.push({
        type: 'summary',
        id: `summary-${index}`,
        content: getSummaryLabel(config),
        onRemove: () => removeSummaryConfig(config.column)
      });
    });

    return chips;
  });

  const hasChips = $derived(allChips.length > 0);

  // `soft` is the shape the six built-in Badge intents already use for state
  // chips: `-emphasis` text on a `-subtle` ground, no border. The table intents
  // used to render `outlined` (border-2, transparent ground) and then paint a
  // ground back on — a two-pixel accent ring around a fill, a hybrid the system
  // has nowhere else. The `-emphasis` step also fixes the text: plain
  // `text-summary` on `bg-summary-subtle` measured 3.5:1, under AA.
  const CHIP_COLORS: Record<string, string> = {
    filter: 'bg-filter-subtle text-filter-emphasis',
    group: 'bg-group-subtle text-group-emphasis',
    summary: 'bg-summary-subtle text-summary-emphasis'
  };
</script>

{#if hasChips}
  <div class="flex flex-wrap gap-1.5 {className}">
    {#each allChips as chip (chip.id)}
      <Badge
        removable={true}
        onRemove={chip.onRemove}
        variant="soft"
        size="sm"
        class={CHIP_COLORS[chip.type] ?? ''}
        aria-label={tt('aria.removeItem', { content: chip.content })}
      >
        {chip.content}
      </Badge>
    {/each}
  </div>
{/if}
