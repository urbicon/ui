import { describe, expect, it } from 'vitest';
import { groupCountText } from './group-count';

/**
 * #159. The first attempt at this shipped the mode split inside `GroupedRow` and
 * left the mobile card list printing "(8 items)" — the exact defect the issue
 * reports — because nothing tested the wording at all, in either layout. The
 * derivation is a module now, and this is what pins it.
 */
describe('groupCountText', () => {
  // A `tt` that echoes the key, so the assertions read as "which key was used"
  // rather than duplicating the English copy (which the parity test owns).
  const tt = ((key: string) => key) as unknown as Parameters<typeof groupCountText>[2];

  it('states a group size in client mode, where the group is whole', () => {
    expect(groupCountText(8, 'client', tt)).toBe('(8 group.items)');
    expect(groupCountText(1, 'client', tt)).toBe('(1 group.item)');
  });

  it('scopes the count to the page in server mode, where it is a slice', () => {
    // The number is unchanged — 8 rows were handed over either way. Only the
    // claim differs, because in server mode the server may hold 400.
    expect(groupCountText(8, 'server-manual', tt)).toBe('(8 group.itemsOnPage)');
    expect(groupCountText(1, 'server-managed', tt)).toBe('(1 group.itemOnPage)');
  });

  it('keeps the singular/plural split in both modes', () => {
    // Two axes crossing (mode × plurality) is where a hand-written second copy
    // gets one cell wrong.
    const cells = [
      groupCountText(0, 'client', tt),
      groupCountText(1, 'client', tt),
      groupCountText(2, 'client', tt),
      groupCountText(0, 'server-manual', tt),
      groupCountText(1, 'server-manual', tt),
      groupCountText(2, 'server-manual', tt)
    ];
    expect(cells).toEqual([
      '(0 group.items)',
      '(1 group.item)',
      '(2 group.items)',
      '(0 group.itemsOnPage)',
      '(1 group.itemOnPage)',
      '(2 group.itemsOnPage)'
    ]);
  });
});
