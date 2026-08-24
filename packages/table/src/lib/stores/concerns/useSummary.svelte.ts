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

  /**
   * The aggregations actually acting on the grid: `state.summaryConfigs` while
   * the summary row is shown, and nothing while it is hidden.
   *
   * The one address for "is a summary in force", and the reason no reader owns
   * a copy of the condition any more (#252). `showSummary` can be `false` with
   * configs in place — `toggleSummary()` is public API and the library ships no
   * UI for it, so a consumer's own "show totals" switch reaches that state —
   * and every surface used to combine the two fields by hand. Three did, five
   * did not: a lit Σ trigger with a badge reading "2", summary chips and head
   * indicator dots all announced aggregations while no summary row existed
   * anywhere, and the tool count on the very same bar said 0.
   *
   * Published as the read-only `state.effectiveSummaryConfigs` (the store binds
   * this getter in), so a consumer building the switch `toggleSummary()` has no
   * UI for reads the same answer the table's own surfaces do.
   *
   * The line between the two lists runs through what a surface *claims*, not
   * through which file it sits in:
   *
   * - **An ambient activity indicator** says something is acting on the rows
   *   right now — the summary row and the mobile band, the chips, the head
   *   dots, the Σ trigger's lit state and counter, both tool counts. All of
   *   them read this list.
   * - **A control's own value** says what a column is *configured* to
   *   aggregate, which outlives the row being hidden — the radio rows of the
   *   summary menu, the tools sheet's panel and the column menu's submenu,
   *   plus the collapsed readout of that submenu. They read
   *   `state.summaryConfigs`; HeaderMenu.svelte carries the full decision.
   */
  const effectiveSummaryConfigs = $derived(state.showSummary ? state.summaryConfigs : []);

  const summaryData = $derived.by((): Record<string, number> => {
    if (effectiveSummaryConfigs.length === 0) return {};
    return calculateSummary(getSortedItems(), effectiveSummaryConfigs, getValue);
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
    if (effectiveSummaryConfigs.length === 0 || !state.effectiveGroupBy) return {};

    const result: Record<string, Record<string, number>> = {};
    Object.entries(getGrouped()).forEach(([groupKey, groupItems]) => {
      result[groupKey] = calculateSummary(groupItems, effectiveSummaryConfigs, getValue);
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
   *
   * Deriving `showSummary` from the count also means every write that ADDS or
   * REPLACES an aggregation unhides — and brings the whole configured set back,
   * not just the edited column. Removing does not: {@link removeSummaryConfig}
   * bypasses this funnel precisely so the "None" row of the editors leaves a
   * hidden table hidden (see its note above).
   *
   * That asymmetry is why the editing controls keep showing
   * `state.summaryConfigs` rather than the in-force list: what a control
   * displays is exactly what the next pick produces — five rows bring the
   * configured set back, "None" removes the one aggregation it names and
   * changes nothing else (#252, the reasoning is in HeaderMenu.svelte).
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
    get effectiveSummaryConfigs() {
      return effectiveSummaryConfigs;
    },
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
