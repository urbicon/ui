import type { TableItem } from '$lib/types/tableTypes';
import {
  calculateSummary,
  findColumnById,
  normalizeSummaryConfigs,
  resolveValueById
} from '$lib/utils';
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

  /**
   * Per-group aggregates over the rows the table holds.
   *
   * In server mode those are the rows of the current page, so a sum here is the
   * sum of a slice — the same claim the group COUNT stopped making in #159, in
   * currency rather than in rows. The count could be repaired by rewording it
   * ("8 on this page"); a sum has no label to reword, and inventing one would be
   * new UI on a summary row that today shows only values. So the scope is
   * documented instead (the server-processing page says it plainly) and the
   * honest total stays a server-side computation the consumer renders itself.
   *
   * Do not "fix" this by hiding group summaries in server mode: a page-local sum
   * is genuinely useful when the endpoint orders by the grouping key, which is
   * the arrangement that page advises.
   */
  const groupedSummaryData = $derived.by((): Record<string, Record<string, number>> => {
    if (!state.showSummary || state.summaryConfigs.length === 0 || !state.effectiveGroupBy)
      return {};

    const result: Record<string, Record<string, number>> = {};
    Object.entries(getGrouped()).forEach(([groupKey, groupItems]) => {
      result[groupKey] = calculateSummary(groupItems, state.summaryConfigs, getValue);
    });
    return result;
  });

  /**
   * Add one aggregation, or replace the existing one for that column (keeping
   * its position). Delegates to {@link setSummaryConfigs} so the one-per-column
   * invariant lives in exactly one place instead of a second findIndex copy
   * (#92): appending the config and normalizing last-wins IS the replace.
   */
  function addSummaryConfig(config: SummaryConfig) {
    setSummaryConfigs([...state.summaryConfigs, config]);
  }

  /**
   * Drop a column's aggregation. Deliberately NOT routed through
   * {@link setSummaryConfigs}: a filter over an already-normalized list cannot
   * introduce a duplicate, so the invariant is safe either way — but the funnel
   * derives `showSummary` from the remaining count, which would switch the row
   * back ON for a reader who had just hidden it with {@link toggleSummary}.
   * Removing the last aggregation still hides the row, because there is nothing
   * left to show.
   */
  function removeSummaryConfig(column: string) {
    state.summaryConfigs = state.summaryConfigs.filter((c) => c.column !== column);

    if (state.summaryConfigs.length === 0) {
      state.showSummary = false;
    }
  }

  function toggleSummary() {
    state.showSummary = !state.showSummary;
  }

  /**
   * Replace the whole set. Every writer that can ADD a config lands here —
   * {@link addSummaryConfig}, the store's public action and the
   * `prefs.defaults.summaries` seed — so the one-per-column invariant is
   * enforced in one place: duplicates collapse last-wins per column (#92),
   * matching what re-adding a column has always done.
   *
   * {@link removeSummaryConfig} writes `state.summaryConfigs` on its own and
   * says there why; it only ever filters, which cannot break the invariant.
   */
  function setSummaryConfigs(configs: SummaryConfig[]) {
    state.summaryConfigs = normalizeSummaryConfigs(configs);
    state.showSummary = state.summaryConfigs.length > 0;
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
