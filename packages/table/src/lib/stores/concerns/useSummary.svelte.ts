import type { TableItem } from '$lib/types/tableTypes';
import { calculateSummary, findColumnById, resolveValueById } from '$lib/utils';
import type { SummaryConfig } from '../TableStore.svelte';
import type { TableState } from './types';

/**
 * Summary concern: manages summary configurations and computes aggregate values.
 * @param state - Shared table state.
 * @param getSortedItems - Getter for sorted items (used for global summary).
 * @param getGrouped - Getter for grouped items (used for per-group summary).
 */
export function useSummary(
  state: TableState,
  getSortedItems: () => TableItem[],
  getGrouped: () => Record<string, TableItem[]>
) {
  // Column-aware value resolver: looks up the accessor by column id so that
  // summaries on function-accessor columns aggregate the computed value
  // rather than the raw property name (which usually does not exist on the row).
  const getValue = (item: TableItem, columnId: string) =>
    resolveValueById(state.columns, item, columnId);

  const summaryData = $derived.by((): Record<string, number> => {
    if (!state.showSummary || state.summaryConfigs.length === 0) return {};
    return calculateSummary(getSortedItems(), state.summaryConfigs, getValue);
  });

  const groupedSummaryData = $derived.by((): Record<string, Record<string, number>> => {
    if (!state.showSummary || state.summaryConfigs.length === 0 || !state.effectiveGroupBy)
      return {};

    const result: Record<string, Record<string, number>> = {};
    Object.entries(getGrouped()).forEach(([groupKey, groupItems]) => {
      result[groupKey] = calculateSummary(groupItems, state.summaryConfigs, getValue);
    });
    return result;
  });

  function addSummaryConfig(config: SummaryConfig) {
    const existing = state.summaryConfigs.findIndex((c) => c.column === config.column);
    if (existing >= 0) {
      state.summaryConfigs[existing] = config;
    } else {
      state.summaryConfigs = [...state.summaryConfigs, config];
    }

    if (state.summaryConfigs.length > 0) {
      state.showSummary = true;
    }
  }

  function removeSummaryConfig(column: string) {
    state.summaryConfigs = state.summaryConfigs.filter((c) => c.column !== column);

    if (state.summaryConfigs.length === 0) {
      state.showSummary = false;
    }
  }

  function toggleSummary() {
    state.showSummary = !state.showSummary;
  }

  function setSummaryConfigs(configs: SummaryConfig[]) {
    state.summaryConfigs = configs;
    state.showSummary = configs.length > 0;
  }

  function getFormattedSummaryValue(column: string, value: number): string {
    if (Number.isNaN(value)) return '–';

    const config = state.summaryConfigs.find((c) => c.column === column);

    if (config?.formatter) {
      return config.formatter(value);
    }

    const col = findColumnById(state.columns, column);
    if (col?.formatter) {
      try {
        const formatted = col.formatter(value, {} as TableItem);
        if (formatted !== null) return formatted;
      } catch (err) {
        if (import.meta.env?.DEV)
          console.warn(`[Table] Column "${column}" formatter threw on summary value:`, err);
      }
    }

    switch (config?.type) {
      case 'avg':
        return Number(value).toFixed(2);
      case 'sum':
      case 'count':
      case 'min':
      case 'max':
        return String(Math.round(Number(value)));
      default:
        return String(value);
    }
  }

  return {
    get summaryData() {
      return summaryData;
    },
    get groupedSummaryData() {
      return groupedSummaryData;
    },
    addSummaryConfig,
    removeSummaryConfig,
    toggleSummary,
    setSummaryConfigs,
    getFormattedSummaryValue
  };
}
