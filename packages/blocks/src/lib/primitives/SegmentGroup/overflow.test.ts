import { describe, expect, it } from 'vitest';
import { type CollapseMark, hostHasRoomAgain } from './overflow';

// The regression this guards: inside a shrinking flex row the group measured
// 120px horizontally and 161px collapsed (`data-collapsed:w-full`), so an
// expand-back check reading the group's own width flipped ~30×/s forever.
// Measured at 390px viewport on the landing page, 2026-07-30.
const SQUEEZED: CollapseMark = { naturalWidth: 129, availWidth: 120, hostWidth: 260 };

describe('hostHasRoomAgain', () => {
  it('stays collapsed while the host has not moved — the oscillation case', () => {
    // The stretched collapsed width (161) would have said "fits" every frame.
    expect(hostHasRoomAgain(SQUEEZED, 260)).toBe(false);
  });

  it('stays collapsed on growth smaller than what the track was missing', () => {
    // 9px missing (129 − 120); 8px of growth is not enough.
    expect(hostHasRoomAgain(SQUEEZED, 268)).toBe(false);
  });

  it('expands once the host has gained the missing width', () => {
    expect(hostHasRoomAgain(SQUEEZED, 269)).toBe(true);
    expect(hostHasRoomAgain(SQUEEZED, 600)).toBe(true);
  });

  it('stays collapsed when the host shrinks further', () => {
    expect(hostHasRoomAgain(SQUEEZED, 200)).toBe(false);
  });

  it('re-collapsing rebases the mark, so a wider host converges instead of looping', () => {
    // Growth beyond the threshold expands; if the group still does not fit it
    // re-collapses against the new host width and needs fresh growth again.
    expect(hostHasRoomAgain(SQUEEZED, 300)).toBe(true);
    const rebased: CollapseMark = { naturalWidth: 129, availWidth: 124, hostWidth: 300 };
    expect(hostHasRoomAgain(rebased, 300)).toBe(false);
    expect(hostHasRoomAgain(rebased, 305)).toBe(true);
  });

  it('expands on any growth when the track was missing nothing measurable', () => {
    // Sub-pixel shortfall (the +1 tolerance already passed) — the mark must not
    // become a permanent trap.
    const hairline: CollapseMark = { naturalWidth: 200, availWidth: 200, hostWidth: 400 };
    expect(hairline.naturalWidth - hairline.availWidth).toBe(0);
    expect(hostHasRoomAgain(hairline, 400)).toBe(true);
  });
});
