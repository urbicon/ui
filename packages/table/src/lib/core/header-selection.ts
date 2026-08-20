/**
 * What the header checkbox may claim — decided once, as a pure function.
 *
 * In server mode the table holds one page of a larger result, and `selectAll`
 * scales against the loaded rows. The header control used to read the
 * client-mode deriveds regardless, so one click selected 20 ids while the
 * checkbox flipped to a full check and the label announced "Deselect all
 * rows" — the one server-mode finding that produced wrong data downstream: a
 * consumer's bulk action read `onSelectionChange` and acted on 20 rows where
 * the reader was told "all". The rule here never claims more than the table
 * can deliver: page-scoped, a full check is unreachable ("all 400" is never
 * provable from one page), the state is at most mixed, and the label names
 * the page.
 */
export interface HeaderSelectionInput {
  /**
   * Server-processed AND the result is larger than the loaded rows. A
   * one-page server result can honestly say "all", so it is not page-scoped.
   */
  pageScoped: boolean;
  /** Every visible (loaded, filtered) row is selected. */
  pageComplete: boolean;
  /** Some but not all visible rows are selected. */
  someSelected: boolean;
  /** Number of visible rows the checkbox acts on. */
  visibleCount: number;
}

export type HeaderSelectionLabelKey =
  | 'selection.selectAllRows'
  | 'selection.deselectAllRows'
  | 'selection.selectPageRows'
  | 'selection.deselectPageRows'
  | 'selection.selectPageRow'
  | 'selection.deselectPageRow';

export interface HeaderSelectionState {
  checked: boolean;
  indeterminate: boolean;
  /** No visible rows to act on — the checkbox has nothing to offer. */
  disabled: boolean;
  labelKey: HeaderSelectionLabelKey;
  labelParams?: { count: number };
}

export function headerSelection(input: HeaderSelectionInput): HeaderSelectionState {
  if (input.visibleCount === 0) {
    // A filter can empty the visible rows while the header keeps rendering
    // (server mode: the page came back empty). "Select the 0 rows on this
    // page" is an offer of nothing — disable instead, same in both modes.
    return {
      checked: false,
      indeterminate: false,
      disabled: true,
      labelKey: 'selection.selectAllRows'
    };
  }

  if (!input.pageScoped) {
    return {
      checked: input.pageComplete,
      indeterminate: input.someSelected,
      disabled: false,
      labelKey: input.pageComplete ? 'selection.deselectAllRows' : 'selection.selectAllRows'
    };
  }

  // The label names the ACTION the click performs (toggleAll): a complete
  // page deselects it, anything less selects the rest of it.
  const single = input.visibleCount === 1;
  const labelKey = input.pageComplete
    ? single
      ? 'selection.deselectPageRow'
      : 'selection.deselectPageRows'
    : single
      ? 'selection.selectPageRow'
      : 'selection.selectPageRows';

  return {
    // A full check is unreachable on purpose: it would claim rows the table
    // has never seen. aria-checked="mixed" is the honest maximum.
    checked: false,
    indeterminate: input.someSelected || input.pageComplete,
    disabled: false,
    labelKey,
    labelParams: { count: input.visibleCount }
  };
}
