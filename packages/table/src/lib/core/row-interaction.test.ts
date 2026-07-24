// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { isSelectingTextIn, resolveRowClickActions } from './row-interaction';

/**
 * The click semantics both row renderers share. jsdom, because the
 * text-selection guard reads `window.getSelection()`; the selection itself is
 * stubbed — jsdom has no real selection model, and what matters here is the
 * decision, not the browser's range bookkeeping.
 */

function stubSelection(options: { text: string; collapsed?: boolean; anchor?: Node | null }): void {
  vi.spyOn(window, 'getSelection').mockReturnValue({
    isCollapsed: options.collapsed ?? false,
    anchorNode: options.anchor ?? null,
    focusNode: options.anchor ?? null,
    toString: () => options.text
  } as unknown as Selection);
}

afterEach(() => {
  vi.restoreAllMocks();
});

const base = {
  hasRowClickHandler: false,
  expandable: false,
  rowClickSelects: false,
  selectable: false
};

describe('resolveRowClickActions', () => {
  it('does nothing on a plain row', () => {
    expect(resolveRowClickActions(base)).toEqual({
      fireRowClick: false,
      toggleExpand: false,
      toggleSelection: false
    });
  });

  it('fires onRowClick and expansion together — both are opt-ins of their own', () => {
    const actions = resolveRowClickActions({
      ...base,
      hasRowClickHandler: true,
      expandable: true
    });
    expect(actions.fireRowClick).toBe(true);
    expect(actions.toggleExpand).toBe(true);
  });

  it('selects only when rowClickSelects and a selection mode are both on', () => {
    expect(resolveRowClickActions({ ...base, rowClickSelects: true }).toggleSelection).toBe(false);
    expect(resolveRowClickActions({ ...base, selectable: true }).toggleSelection).toBe(false);
    expect(
      resolveRowClickActions({ ...base, rowClickSelects: true, selectable: true }).toggleSelection
    ).toBe(true);
  });

  it('skips selection when the click ended a text selection inside the row', () => {
    const row = document.createElement('tr');
    document.body.append(row);
    stubSelection({ text: 'Ada Lovelace', anchor: row });

    const actions = resolveRowClickActions({
      ...base,
      rowClickSelects: true,
      selectable: true,
      row
    });
    expect(actions.toggleSelection).toBe(false);
    row.remove();
  });

  it('still selects when the selection lives elsewhere on the page', () => {
    // getSelection() is document-wide: a leftover highlight in an article next
    // to the table must not make its rows unclickable.
    const row = document.createElement('tr');
    const elsewhere = document.createElement('p');
    document.body.append(row, elsewhere);
    stubSelection({ text: 'unrelated prose', anchor: elsewhere });

    expect(
      resolveRowClickActions({ ...base, rowClickSelects: true, selectable: true, row })
        .toggleSelection
    ).toBe(true);
    row.remove();
    elsewhere.remove();
  });
});

describe('isSelectingTextIn', () => {
  it('is false for a collapsed selection (a plain caret click)', () => {
    const row = document.createElement('tr');
    stubSelection({ text: '', collapsed: true, anchor: row });
    expect(isSelectingTextIn(row)).toBe(false);
  });

  it('is false for a whitespace-only selection', () => {
    const row = document.createElement('tr');
    stubSelection({ text: '   \n ', anchor: row });
    expect(isSelectingTextIn(row)).toBe(false);
  });

  it('stays conservative without a row to scope against', () => {
    stubSelection({ text: 'something', anchor: null });
    expect(isSelectingTextIn(null)).toBe(true);
  });
});
