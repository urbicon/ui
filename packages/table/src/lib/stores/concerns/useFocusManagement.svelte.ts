import type { TableState } from './types';

export type FocusDirection = 'up' | 'down' | 'first' | 'last';

/**
 * Focus management concern: tracks which row is focused for keyboard navigation.
 * Uses the roving tabindex pattern (WAI-ARIA Grid).
 * @param _state - Shared table state (unused here; kept for concern-signature parity).
 * @param getVisibleItemCount - Getter for the number of currently visible rows.
 */
export function useFocusManagement(_state: TableState, getVisibleItemCount: () => number) {
  let focusedRowIndex = $state(0);

  /** Reset focus to first row when data changes */
  function resetFocus() {
    focusedRowIndex = 0;
  }

  function setFocusedRow(index: number) {
    const count = getVisibleItemCount();
    if (count === 0) {
      focusedRowIndex = 0;
      return;
    }
    focusedRowIndex = Math.max(0, Math.min(index, count - 1));
  }

  function moveFocus(direction: FocusDirection) {
    const count = getVisibleItemCount();
    if (count === 0) return;

    switch (direction) {
      case 'up':
        setFocusedRow(focusedRowIndex - 1);
        break;
      case 'down':
        setFocusedRow(focusedRowIndex + 1);
        break;
      case 'first':
        setFocusedRow(0);
        break;
      case 'last':
        setFocusedRow(count - 1);
        break;
    }
  }

  function isFocusedRow(index: number): boolean {
    return focusedRowIndex === index;
  }

  return {
    get focusedRowIndex() {
      return focusedRowIndex;
    },
    resetFocus,
    setFocusedRow,
    moveFocus,
    isFocusedRow
  };
}
