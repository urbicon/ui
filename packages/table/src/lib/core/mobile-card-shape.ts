import type { Column } from '$lib/types/tableTypes';

/**
 * How a mobile card splits its columns and who owns which gesture.
 *
 * Kept out of the component because the interesting part is not the markup but
 * the rule that decides it. Two constraints drive all of it:
 *
 *  1. **The card itself is never a control.** Its detail grid renders
 *     `column.cell` / `column.component`, i.e. arbitrary consumer markup —
 *     links, badges, action buttons. A card-wide `role="button"` would nest
 *     those inside a control (an axe `nested-interactive` violation) and make
 *     one tap fire two things: the consumer's button and the card. The card's
 *     HEADLINE is the control instead; the grid stays plain content.
 *  2. **A control needs a keyboard.** Whatever ends up carrying the gesture is
 *     a real `<button>`, so Enter/Space come for free — the previous shape
 *     hung `role`/`tabindex`/`onkeydown` on one flag and `onclick` on another,
 *     and a row-click card with details ended up mouse-only.
 */

/** What pressing the headline does. */
export type MobileCardAction = 'open' | 'toggle' | 'none';

export interface MobileCardShape {
  /** Emphasized, label-less — the record's primary identifier. */
  titleColumn: Column | undefined;
  /** Label-less second line; only in `collapsed` mode. */
  subtitleColumn: Column | undefined;
  /** Label/value pairs in the grid. */
  detailColumns: Column[];
  /** There is something behind the chevron at all. */
  hasToggle: boolean;
  /** What pressing the headline does. */
  headlineAction: MobileCardAction;
  /**
   * The chevron needs a button of its own — the headline is already spoken
   * for by a row click, or there is no headline to press.
   */
  needsOwnToggle: boolean;
}

export interface MobileCardShapeOptions {
  /** Card columns in display order — priority 1/unset and 2, priority 3 dropped. */
  cardColumns: Column[];
  /** `collapsed` hides everything from the third column on until tapped. */
  details: 'collapsed' | 'expanded';
  /** The consumer supplied `expandedRowContent`. */
  expandable: boolean;
  /** The consumer supplied a row-click handler. */
  hasRowClick: boolean;
}

export function resolveMobileCardShape(options: MobileCardShapeOptions): MobileCardShape {
  const { cardColumns, details, expandable, hasRowClick } = options;
  const collapsible = details === 'collapsed';

  const titleColumn = cardColumns[0];
  const subtitleColumn = collapsible ? cardColumns[1] : undefined;
  const detailColumns = collapsible ? cardColumns.slice(2) : cardColumns.slice(1);

  // What a closed card hides: the detail grid plus, when the consumer supplied
  // one, the custom expanded block. With neither there is nothing to open.
  // In `expanded` mode the chevron keeps its old meaning — it opens only the
  // consumer's custom block, because the grid is always out there.
  const hasToggle = collapsible ? detailColumns.length > 0 || expandable : expandable;

  // A row click is the consumer's business and always wins the headline; only a
  // card without one may spend its headline on itself. With no title column
  // there is no headline to press at all — a table whose every column is
  // desktop-only, or one the reader hid down to nothing through the column menu.
  const headlineAction: MobileCardAction = !titleColumn
    ? 'none'
    : hasRowClick
      ? 'open'
      : hasToggle
        ? 'toggle'
        : 'none';

  // Whatever the headline did not take, the chevron must — otherwise the detail
  // grid and `expandedRowContent` sit in the DOM with nothing able to open them.
  const needsOwnToggle = hasToggle && headlineAction !== 'toggle';

  return { titleColumn, subtitleColumn, detailColumns, hasToggle, headlineAction, needsOwnToggle };
}
