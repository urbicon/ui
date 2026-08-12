// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Calendar from './Calendar.svelte';
import type { CalendarEvent } from './calendar.types';

// Narrow-viewport degradation of the week view (issue #96).
//
// The week used to render seven equal columns at every width — ~50 px per day on
// a 390 px phone — and its day heads lived ABOVE the hour grid in their own
// seven-column row, so they were also offset from the columns by the width of
// the time gutter. Both follow from one structure, and both are fixed by one:
// heads, all-day band and hours are now rows of a single CSS grid whose track
// list keeps every day at `--blocks-calendar-day-min-width`, and that grid is
// the scroll port for both axes.
//
// jsdom does no layout, so nothing here can assert a rendered pixel. What it CAN
// assert is the structure the layout follows from, which is exactly where the
// bug lived: which element carries the track list, which elements sit inside it,
// and which stay pinned. The widths themselves are CSS — a `minmax()` track and
// a custom property — so the test reads them as the strings the browser gets.
//
// Test stack per repo conventions: svelte's own mount/unmount, native matchers,
// dates pinned to June 2026 (never the wall clock, never the runtime locale).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const anchor = new Date(2026, 5, 15); // Mon 15 Jun 2026

function renderCalendar(props: Partial<ComponentProps<typeof Calendar>>) {
  const instance = mount(Calendar, {
    target: document.body,
    props: { defaultDate: anchor, animated: false, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

/** The hour grid: the one element carrying the inline day count. */
function timeGrid(): HTMLElement {
  const el = document.querySelector<HTMLElement>('[style*="--blocks-calendar-day-count"]');
  expect(el).not.toBeNull();
  return el as HTMLElement;
}

/** The track list is a class; only the count it repeats is inline. */
const trackList = () => timeGrid().className;
const dayCount = () => timeGrid().getAttribute('style') ?? '';

const dayHeads = () => Array.from(document.querySelectorAll<HTMLElement>('[data-weekday]'));
const dayColumns = () => Array.from(document.querySelectorAll<HTMLElement>('[data-day-column]'));

/**
 * jsdom lays nothing out, so the grid's own overflow is always 0. Stub the two
 * numbers the measurement reads — the ResizeObserver in the setup file is a
 * no-op, so the value that counts is the one taken at mount.
 */
function stubHorizontalOverflow(overflowing: boolean) {
  vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(360);
  vi.spyOn(Element.prototype, 'scrollWidth', 'get').mockReturnValue(overflowing ? 712 : 360);
}

describe('Calendar week view — one scrolling column system (#96)', () => {
  it('gives every day a minimum width instead of a seventh of whatever is there', () => {
    renderCalendar({ view: 'week' });

    // Day tracks are `minmax(min, 1fr)`: they share the width when it is there
    // and hold the minimum — scrolling the grid — when it is not. The gutter
    // takes what its labels need, not a share of the days. The fallbacks are not
    // decoration: a bare `var()` with nothing behind it voids the whole
    // declaration, taking the track list with it.
    expect(trackList()).toContain(
      'grid-cols-[auto_repeat(var(--blocks-calendar-day-count,1),minmax(var(--blocks-calendar-day-min-width,6rem),1fr))]'
    );
    // Only the count is inline — a `grid-template-columns` there would beat
    // anything `slotClasses.timeGrid` could say, and would survive `unstyled`.
    expect(dayCount()).toContain('--blocks-calendar-day-count: 7');
    expect(dayCount()).not.toContain('grid-template-columns');
  });

  it('scrolls in the grid, not the page — the track list sits on the scroll port', () => {
    renderCalendar({ view: 'week' });
    expect(timeGrid().className).toContain('overflow-auto');
    // The auto-scroll to "now" reads the hour rows' offsetTop against this box.
    expect(timeGrid().className).toContain('relative');

    // The wrapper between the grid and the layout must be allowed to shrink, or
    // the grid never scrolls: it is a grid item with visible overflow, so its
    // automatic minimum size is the grid's min-content — seven day tracks at
    // their minimum. Measured in Chromium against a 360 px card: without
    // `min-w-0` the wrapper lays out at 712 px and clientWidth equals
    // scrollWidth (nothing to scroll, the layout's overflow:hidden eats the
    // difference); with it, 360 against 712.
    expect(timeGrid().parentElement?.className).toContain('min-w-0');
  });

  it.each([
    ['sm', '5rem'],
    ['md', '6rem'],
    ['lg', '7rem']
  ] as const)(
    'resolves the minimum from size=%s on the root, where a consumer can',
    (size, min) => {
      renderCalendar({ view: 'week', size });

      // On the ROOT: a declaration on the grid itself would beat anything the
      // consumer sets further up, and the root is where their `style` prop lands.
      const root = document.body.firstElementChild as HTMLElement;
      expect(root.className).toContain(`[--blocks-calendar-day-min-width:${min}]`);
      expect(timeGrid().className).not.toContain('--blocks-calendar-day-min-width:');
    }
  );

  it('keeps the day heads inside the scrolling grid, so they cannot drift off their columns', () => {
    renderCalendar({ view: 'week' });

    const heads = dayHeads();
    expect(heads).toHaveLength(7);
    for (const head of heads) {
      expect(head.closest('[style*="--blocks-calendar-day-count"]')).toBe(timeGrid());
    }

    // The grid's own children ARE the cells: corner + 7 heads + gutter + 7 days.
    // Anything laid out beside the grid instead of in it changes this count.
    expect(timeGrid().children).toHaveLength(16);
  });

  it('pins the corner and the hour gutter so the time stays readable while scrolling', () => {
    renderCalendar({ view: 'week' });

    const cells = Array.from(timeGrid().children) as HTMLElement[];
    const [corner, firstHead] = cells;
    // Corner over both axes, the head strip over the vertical one, gutter over
    // the horizontal one — stacked in that order so none of them scrolls through
    // another, and all of them over the current-time line (z-10) and the events
    // (inline z 1…n). calendar.variants.test.ts asserts the order numerically.
    expect(corner.className).toContain('sticky');
    expect(corner.className).toContain('left-0');
    expect(corner.className).toContain('top-0');
    expect(corner.className).toContain('z-50');
    expect(firstHead.className).toContain('sticky');
    expect(firstHead.className).toContain('top-0');
    expect(firstHead.className).toContain('z-30');

    const gutter = cells[8]; // corner + 7 heads
    expect(gutter.className).toContain('sticky');
    expect(gutter.className).toContain('left-0');
    expect(gutter.className).toContain('z-40');
    // A pinned cell has to bring its own surface or the columns show through it.
    expect(gutter.className).toContain('bg-surface-base/95');
    // It is the hour gutter, not an empty spacer: the labels live in it.
    expect(gutter.textContent).toContain('07:00');
    // The hours start BELOW the strip — which is exactly why the auto-scroll to
    // "now" has to add the gutter's offsetTop instead of starting at 0.
    expect(cells.indexOf(gutter)).toBeGreaterThan(cells.indexOf(firstHead));
  });

  it('puts the all-day band in the same column system, inside the pinned strip', () => {
    const events: CalendarEvent[] = [
      { id: 'a', title: 'Handover', start: new Date(2026, 5, 16), allDay: true }
    ];
    renderCalendar({ view: 'week', events });

    // Still corner + 7 heads + gutter + 7 days: the band is not a row of its
    // own, it is the lower half of each head cell. A second sticky ROW would
    // need the head's measured height as its `top`; without one it scrolls out
    // of sight — and the mount jump to the current time does that immediately.
    expect(timeGrid().children).toHaveLength(16);

    const heads = dayHeads();
    const bandCells = heads.map((head) => head.parentElement as HTMLElement);
    // The band is cells, not a full-width strip laid over them: the event lands
    // in Tuesday's cell and Monday's stays empty. A strip could not tell the two
    // apart.
    expect(bandCells[0].textContent).not.toContain('Handover');
    expect(bandCells[1].textContent).toContain('Handover');
    // Both halves ride in one sticky cell, so one pin carries them.
    expect(bandCells[1].className).toContain('sticky');
    expect(bandCells[1].className).toContain('top-0');
    expect(bandCells[1].querySelector('[data-weekday]')).toBe(heads[1]);
  });

  it('moves the roving focus across the heads, which brings the day into view', () => {
    renderCalendar({ view: 'week' });

    const heads = dayHeads();
    // The roving tabindex is unchanged by the restructure: one stop for the row.
    expect(heads.map((h) => h.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1',
      '-1'
    ]);

    heads[0].focus();
    heads[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(heads[1]);

    heads[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    flushSync();
    expect(document.activeElement).toBe(heads[6]);
    // Focusing an element inside a scroll port is what scrolls it into view —
    // the reason the heads had to move into the grid rather than sit above it.
    expect(heads[6].closest('[style*="--blocks-calendar-day-count"]')).toBe(timeGrid());
  });

  it('lets `unstyled` + slotClasses rebuild the column system (rung 5 of the ladder)', () => {
    renderCalendar({
      view: 'week',
      unstyled: true,
      slotClasses: { timeGrid: 'grid overflow-auto grid-cols-[auto_repeat(7,5rem)]' }
    });

    // The whole point of moving the track list off the inline style: an inline
    // `grid-template-columns` would beat this, and on main the flex scaffolding
    // was hardcoded markup that `unstyled` could not reach either.
    expect(timeGrid().className).toBe('grid overflow-auto grid-cols-[auto_repeat(7,5rem)]');
    // The day count stays — it is data, so a consumer's own `repeat()` can use
    // it — and nothing of the library's own track list is left to fight with.
    expect(dayCount()).toContain('--blocks-calendar-day-count: 7');
  });

  it('hands the horizontal axis to the scroller only while the days overflow', () => {
    // `swipeable` writes `pan-y` by default, which forbids the browser the very
    // pan this grid needs (Blink intersects touch-action down the tree). So the
    // week gives the axis up — but only while there IS something to scroll:
    // measured in Chromium, a horizontal drag under `touch-action: auto` always
    // ends in `pointercancel`, whether or not anything can scroll, so an
    // unconditional opt-out would cost the swipe at every width.
    stubHorizontalOverflow(true);
    renderCalendar({ view: 'week' });
    expect(document.querySelector<HTMLElement>('[role="grid"]')?.style.touchAction).toBe('');
  });

  it('keeps the swipe while the seven columns fit', () => {
    stubHorizontalOverflow(false);
    renderCalendar({ view: 'week' });
    expect(document.querySelector<HTMLElement>('[role="grid"]')?.style.touchAction).toBe('pan-y');
  });
});

describe('Calendar day view — unchanged by the week fix', () => {
  it('renders one day track and no head row', () => {
    renderCalendar({ view: 'day' });

    expect(dayCount()).toContain('--blocks-calendar-day-count: 1');
    expect(dayHeads()).toHaveLength(0);
    // Gutter + the single day column, nothing else — and the gutter FIRST, which
    // is what makes its `offsetTop` zero here and the strip's height in the week.
    expect(timeGrid().children).toHaveLength(2);
    expect(timeGrid().children[0].textContent).toContain('07:00');
    expect(timeGrid().children[1]).toBe(dayColumns()[0]);
    expect(timeGrid().parentElement?.className).toContain('min-w-0');
  });

  it('measures the event column the resize reads from, in both views', () => {
    // `resizableEvent` maps pixels to minutes against this box, so it has to be
    // the one spanning startHour…endHour. The marker is the contract; the
    // arithmetic lives in calendar.drag.test.ts.
    renderCalendar({ view: 'day' });
    expect(dayColumns()).toHaveLength(1);
    dispose?.();
    dispose = undefined;
    document.body.replaceChildren();

    renderCalendar({ view: 'week' });
    expect(dayColumns()).toHaveLength(7);
    for (const column of dayColumns()) {
      expect(column.parentElement).toBe(timeGrid());
    }
  });

  it('keeps its swipe navigation, gesture contract included', () => {
    renderCalendar({ view: 'day' });

    // One column never overflows, so the day view has no scroll to protect and
    // keeps reserving the horizontal axis for the swipe.
    const layout = document.querySelector<HTMLElement>('[role="region"]');
    expect(layout?.style.touchAction).toBe('pan-y');
  });
});
