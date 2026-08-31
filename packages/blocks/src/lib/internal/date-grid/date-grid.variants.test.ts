import { describe, expect, it } from 'vitest';
import { dateGridRow } from './date-grid.variants';

describe('dateGridRow', () => {
  it('picks the column template from showWeekNumber', () => {
    // No `defaultVariants`, so both branches are named by the caller.
    expect(dateGridRow({ showWeekNumber: false }).split(' ')).toEqual(['grid', 'grid-cols-7']);
    expect(dateGridRow({ showWeekNumber: true }).split(' ')).toEqual([
      'grid',
      'grid-cols-[minmax(2rem,auto)_repeat(7,minmax(0,1fr))]'
    ]);
  });

  it('lets the caller strip the geometry it collides with', () => {
    // Why the geometry is a config and not a prefix on the caller's string:
    // as the base it loses the bucket outright, so a consumer that asks for
    // one column gets one column (#349).
    const stacked = dateGridRow({ showWeekNumber: false, class: 'grid-cols-1' });
    expect(stacked).toContain('grid-cols-1');
    expect(stacked.split(' ')).not.toContain('grid-cols-7');

    // A breakpoint-scoped override is a bucket of its own, so it composes with
    // the unprefixed template instead of replacing it — which is what lets
    // Planner stack its week rows below `md` while the desktop layout stands.
    const responsive = dateGridRow({ showWeekNumber: false, class: 'max-md:grid-cols-1' });
    expect(responsive).toContain('max-md:grid-cols-1');
    expect(responsive.split(' ')).toContain('grid-cols-7');
  });
});
