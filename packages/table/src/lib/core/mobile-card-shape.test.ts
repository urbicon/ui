import { describe, expect, it } from 'vitest';
import type { Column } from '$lib/types/tableTypes';
import { type MobileCardShapeOptions, resolveMobileCardShape } from './mobile-card-shape';

const col = (accessor: string): Column => ({ accessor, title: accessor }) as Column;
const FOUR = [col('name'), col('role'), col('team'), col('since')];

function shape(overrides: Partial<MobileCardShapeOptions> = {}) {
  return resolveMobileCardShape({
    cardColumns: FOUR,
    details: 'collapsed',
    expandable: false,
    hasRowClick: false,
    ...overrides
  });
}

describe('resolveMobileCardShape — column split', () => {
  it('collapsed: first column titles, second subtitles, rest hide', () => {
    const s = shape();
    expect(s.titleColumn?.accessor).toBe('name');
    expect(s.subtitleColumn?.accessor).toBe('role');
    expect(s.detailColumns.map((c) => c.accessor)).toEqual(['team', 'since']);
  });

  it('expanded: no subtitle, every other column in the grid', () => {
    const s = shape({ details: 'expanded' });
    expect(s.titleColumn?.accessor).toBe('name');
    expect(s.subtitleColumn).toBeUndefined();
    expect(s.detailColumns.map((c) => c.accessor)).toEqual(['role', 'team', 'since']);
  });

  it('survives a table with fewer columns than the split needs', () => {
    expect(shape({ cardColumns: [] }).titleColumn).toBeUndefined();
    const one = shape({ cardColumns: [col('name')] });
    expect(one.subtitleColumn).toBeUndefined();
    expect(one.detailColumns).toEqual([]);
  });
});

describe('resolveMobileCardShape — what can be opened', () => {
  it('has nothing to toggle when title and subtitle are the whole record', () => {
    const s = shape({ cardColumns: [col('name'), col('role')] });
    expect(s.hasToggle).toBe(false);
    expect(s.headlineAction).toBe('none');
    expect(s.needsOwnToggle).toBe(false);
  });

  it('toggles when detail columns are hidden', () => {
    const s = shape();
    expect(s.hasToggle).toBe(true);
    expect(s.headlineAction).toBe('toggle');
  });

  it('toggles for expandedRowContent alone, even with no detail columns', () => {
    expect(shape({ cardColumns: [col('name'), col('role')], expandable: true }).hasToggle).toBe(
      true
    );
  });

  // The `expanded` mode is the pre-v6.48 shape: the chevron opens only the
  // consumer's custom block, never the grid — which is always out there.
  it('expanded: no chevron without expandedRowContent', () => {
    expect(shape({ details: 'expanded' }).hasToggle).toBe(false);
    expect(shape({ details: 'expanded', expandable: true }).hasToggle).toBe(true);
  });
});

describe('resolveMobileCardShape — who owns the gesture', () => {
  // The card is never a control (its grid renders consumer markup), so the
  // headline carries the gesture and the chevron only splits off when the
  // headline is already spoken for.
  it('spends the headline on the details when nothing else claims it', () => {
    const s = shape();
    expect(s.headlineAction).toBe('toggle');
    expect(s.needsOwnToggle).toBe(false);
  });

  it('lets a row click win the headline and moves the chevron to its own button', () => {
    const s = shape({ hasRowClick: true });
    expect(s.headlineAction).toBe('open');
    expect(s.needsOwnToggle).toBe(true);
  });

  // The regression this pins: with `role`/`tabindex`/`onkeydown` hung on one
  // flag and `onclick` on another, a row-click card with details ended up a
  // plain div — reachable by mouse only, with the chevron leading elsewhere.
  it('never leaves a row click without a control to carry it', () => {
    for (const cardColumns of [FOUR, [col('name'), col('role')], [col('name')]]) {
      expect(shape({ cardColumns, hasRowClick: true }).headlineAction).toBe('open');
    }
  });

  it('keeps selection out of the decision — the checkbox is a sibling, not a child', () => {
    // Selection used to force the chevron onto its own button, because the card
    // itself was the control and could not hold a checkbox. The headline is the
    // control now, and the checkbox sits beside it.
    expect(shape().headlineAction).toBe('toggle');
    expect(shape().needsOwnToggle).toBe(false);
  });

  // A table whose every column is desktop-only, or one the reader hid down to
  // nothing: there is no headline to press, so the chevron must stand alone —
  // otherwise `expandedRowContent` is unreachable.
  it('gives the chevron its own button when there is no headline at all', () => {
    const s = shape({ cardColumns: [], expandable: true });
    expect(s.titleColumn).toBeUndefined();
    expect(s.hasToggle).toBe(true);
    expect(s.needsOwnToggle).toBe(true);
  });
});
