import { describe, expect, it } from 'vitest';
import { calendarVariants } from './calendar.variants';

describe('calendarVariants', () => {
  it('exposes every slot as a function (~60 slots) and never emits dark: overrides', () => {
    // Too many slots to hand-list, so derive them: assert each is callable AND that its class
    // output stays free of `dark:` overrides (the light-dark() maxim) in one pass.
    const styles = calendarVariants();
    const entries = Object.entries(styles);
    expect(entries.length).toBeGreaterThan(50);
    for (const [name, fn] of entries) {
      expect(typeof fn, `slot ${name} should be a function`).toBe('function');
      expect((fn as () => string)(), `slot ${name} must not emit dark:`).not.toMatch(/\bdark:/);
    }
  });

  it('stacks the pinned strip over the current-time line and the events (#96)', () => {
    // One stacking context for all of them: `timeDayColumn` is `relative` with
    // `z-index: auto`, so it opens none and the line's z resolves against the
    // head cell's. Equal values would hand the win to the later-in-tree day
    // columns — "now" painted across the weekday buttons whenever the grid is
    // scrolled past it, which is the normal state after the mount auto-scroll.
    const s = calendarVariants();
    const z = (classes: string) =>
      Number(/(?:^|\s)z-(\d+)(?:\s|$)/.exec(classes)?.[1] ?? Number.NaN);
    const corner = z(s.timeCorner());
    const gutter = z(s.timeGutter());
    const head = z(s.timeHeadCell());
    const line = z(s.currentTimeLine());

    expect(corner).toBeGreaterThan(gutter);
    expect(gutter).toBeGreaterThan(head);
    expect(head).toBeGreaterThan(line);
    // Events carry an inline `z-index` of their overlap column, capped at 9 in
    // CalendarTimeEvent, so the line has to clear 9 and stay under the strip.
    expect(line).toBeGreaterThan(9);
  });

  it('gives every gridline of the time grid one owner (#210)', () => {
    // The hairline token is translucent, so two stacked 1px borders composite
    // visibly darker instead of merging. The grid owns its top edge alone, the
    // strip's bottom edge lives on the head cell (flush with the corner) rather
    // than on the all-day band inside it, and the head cell continues the day
    // columns' vertical line through the pinned strip.
    const s = calendarVariants();
    expect(s.weekTimeLayout()).not.toContain('border-t');
    expect(s.timeGrid()).toContain('border-t');
    expect(s.allDayArea()).not.toContain('border-b');
    expect(s.timeHeadCell()).toContain('border-b');
    expect(s.timeCorner()).toContain('border-b');
    expect(s.timeHeadCell()).toContain('border-l');
    expect(s.timeDayColumn()).toContain('border-l');
  });

  it('keeps the time grid positioned and its track list in a class, not in markup', () => {
    // `relative` is load-bearing: CalendarTimeGrid's auto-scroll reads the hour
    // rows' `offsetTop` against this box. The track list is a class rather than
    // an inline style so `unstyled` strips the column system with the rest of
    // the look and `slotClasses.timeGrid` can replace it — an inline
    // `grid-template-columns` beats every class a consumer could write.
    const base = calendarVariants().timeGrid();
    expect(base).toContain('relative');
    expect(base).toContain('grid-cols-[auto_repeat(var(--blocks-calendar-day-count,1)');
    expect(base).toContain('minmax(var(--blocks-calendar-day-min-width,6rem),1fr)');

    // Scroll padding = the hour gutter's width per size, so arrow-keying back to
    // the first day reveals it beside the pinned gutter instead of under it.
    for (const [size, pad, gutterWidth] of [
      ['sm', 'scroll-pl-8', 'w-8'],
      ['md', 'scroll-pl-10', 'w-10'],
      ['lg', 'scroll-pl-12', 'w-12']
    ] as const) {
      expect(calendarVariants({ size }).timeGrid()).toContain(pad);
      expect(calendarVariants({ size }).timeLabel()).toContain(gutterWidth);
    }
  });

  it('scales the day cell height with size', () => {
    expect(calendarVariants({ size: 'sm' }).day()).toContain('h-8');
    expect(calendarVariants({ size: 'md' }).day()).toContain('h-12');
    expect(calendarVariants({ size: 'lg' }).day()).toContain('h-16');
  });

  it('floors the year-view mini day cell at text-3xs while its box keeps scaling', () => {
    // sm previously hardcoded text-[9px]; it now shares md's 10px floor because
    // --text-3xs is the smallest step the scale offers. The box still shrinks
    // (size-3 vs size-4), so the two sizes stay distinguishable.
    expect(calendarVariants({ size: 'sm' }).yearMiniDay()).toContain('text-3xs');
    expect(calendarVariants({ size: 'sm' }).yearMiniDay()).toContain('size-3');
    expect(calendarVariants({ size: 'md' }).yearMiniDay()).toContain('text-3xs');
    expect(calendarVariants({ size: 'md' }).yearMiniDay()).toContain('size-4');
    expect(calendarVariants({ size: 'lg' }).yearMiniDay()).toContain('text-xs');
  });

  it('drives the sm week/time slots off text-2xs, beating the base text size', () => {
    // These seven slots referenced text-2xs before --text-2xs existed: the class
    // emitted no CSS *and* the tv() engine read it as a color, so multiDayBar kept
    // the base slot's text-xs and the rest inherited. Guards both halves of that.
    const sm = calendarVariants({ size: 'sm' });
    for (const slot of [
      'weekColumnDayName',
      'weekAllDayEvent',
      'multiDayBar',
      'timeLabel',
      'timeEvent',
      'miniCalendarWeekday',
      'miniCalendarDay'
    ] as const) {
      expect(sm[slot]()).toContain('text-2xs');
    }
    expect(sm.multiDayBar()).not.toContain('text-xs');
    expect(calendarVariants({ size: 'md' }).multiDayBar()).toContain('text-xs');
  });

  it('applies variant chrome — bordered adds a frame, ghost strips hover fills', () => {
    const bordered = calendarVariants({ variant: 'bordered' });
    expect(bordered.base()).toContain('border');
    expect(bordered.base()).toContain('rounded-lg');

    const ghost = calendarVariants({ variant: 'ghost' });
    expect(ghost.base()).toContain('bg-transparent');
    expect(ghost.day()).toContain('hover:bg-transparent');
    expect(ghost.header()).toContain('border-b-0');
  });

  it('distinguishes today / selected / today+selected day states', () => {
    const today = calendarVariants({ dayState: 'today' });
    expect(today.day()).toContain('bg-primary');
    expect(today.dayNumber()).toContain('text-text-on-primary');

    const selected = calendarVariants({ dayState: 'selected' });
    expect(selected.day()).toContain('bg-primary-subtle');
    expect(selected.day()).toContain('ring-primary');
    expect(selected.dayNumber()).toContain('text-primary');

    // today+selected is the strongest state — filled primary AND an offset ring.
    const both = calendarVariants({ dayState: 'todaySelected' });
    expect(both.day()).toContain('bg-primary');
    expect(both.day()).toContain('ring-2');
    expect(both.day()).toContain('ring-offset-1');
  });

  it('rounds range selection for visual continuity — the whole range reads as one bar', () => {
    // Start keeps its left corner but squares the right; end mirrors it; middle squares both.
    // Break any of these and the range shows rounded gaps between adjacent days.
    expect(calendarVariants({ dayState: 'rangeStart' }).day()).toContain('rounded-r-none');
    expect(calendarVariants({ dayState: 'rangeEnd' }).day()).toContain('rounded-l-none');
    expect(calendarVariants({ dayState: 'inRange' }).day()).toContain('rounded-none');
    // The lighter preview range mirrors the in-range squaring.
    expect(calendarVariants({ dayState: 'previewRange' }).day()).toContain('rounded-none');
  });

  it('dims disabled days and de-emphasizes outside-month days', () => {
    const disabled = calendarVariants({ dayState: 'disabled' });
    expect(disabled.day()).toContain('opacity-40');
    expect(disabled.day()).toContain('cursor-not-allowed');
    expect(disabled.dayNumber()).toContain('text-text-disabled');

    expect(calendarVariants({ dayState: 'outsideMonth' }).dayNumber()).toContain(
      'text-text-quaternary'
    );
  });

  it('bolds days with events and flips the today dot to a light fill for contrast (compound)', () => {
    expect(calendarVariants({ hasEvents: true }).dayNumber()).toContain('font-bold');
    // On a today cell the dot sits on filled primary, so the compound flips it to a light fill.
    expect(calendarVariants({ dayState: 'today' }).dot()).toContain('bg-surface-base');
  });
});
