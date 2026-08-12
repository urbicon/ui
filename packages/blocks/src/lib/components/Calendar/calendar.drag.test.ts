// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resizableEvent } from './calendar.drag';
import type { CalendarEvent } from './calendar.types';

// Unit tests over the resizableEvent attachment with plain DOM nodes (no Svelte
// mount needed): its contract — handle listeners, the document-level cursor and
// the event block's inline height — is directly observable. The unmount case is
// the MED finding: the old teardown only removed the pointerdown listener, so a
// resize in flight leaked the row-resize cursor, the inline height, and live
// move/up listeners past the component's lifetime.
//
// jsdom note: there is no PointerEvent/capture model — MouseEvents with pointer
// type names reach the same listeners, and set/releasePointerCapture are
// stubbed per element (vitest-setup only guards the prototype).

afterEach(() => {
  document.body.replaceChildren();
  document.body.style.cursor = '';
});

function setup() {
  const handle = document.createElement('div');
  const eventEl = document.createElement('div');
  const dayColumnEl = document.createElement('div');
  document.body.append(dayColumnEl, eventEl, handle);
  // No capture model in jsdom — belt and braces regardless of jsdom version.
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};

  const event: CalendarEvent = {
    id: 'e1',
    title: 'Resize me',
    start: new Date(2026, 5, 15, 9, 0),
    end: new Date(2026, 5, 15, 10, 0),
    allDay: false
  };
  const onResizeEnd = vi.fn();
  const teardown = resizableEvent({
    event,
    dayColumnEl,
    eventEl,
    startHour: 7,
    endHour: 20,
    onResizeEnd
  })(handle) as () => void;

  return { handle, eventEl, onResizeEnd, teardown };
}

/**
 * The arithmetic half: jsdom lays nothing out, so the two boxes the calculation
 * reads are stubbed with the geometry a browser would produce — md defaults,
 * 7…20 h at 48 px an hour, i.e. a 624 px day column.
 *
 * `stripHeight` is what broke this (#96): in the week view the scroll port also
 * carries the pinned head/all-day strip above the hours, so it is NOT the box
 * that spans 07:00…20:00. The column is, in both views — which is why the same
 * expectation holds for a strip of 78 px and one of 0.
 */
function setupWithGeometry(stripHeight: number) {
  const handle = document.createElement('div');
  const eventEl = document.createElement('div');
  const dayColumnEl = document.createElement('div');
  document.body.append(dayColumnEl, eventEl, handle);
  handle.setPointerCapture = () => {};
  handle.releasePointerCapture = () => {};

  const COLUMN_TOP = 100; // viewport y of the day column's top edge = 07:00
  const COLUMN_HEIGHT = 624; // 13 hours × 48 px
  // The event ends at 12:00 after the drag: (12−7)/13 × 624 = 240 px down.
  const eventBottom = COLUMN_TOP + 240;

  dayColumnEl.getBoundingClientRect = () =>
    ({ top: COLUMN_TOP, bottom: COLUMN_TOP + COLUMN_HEIGHT, height: COLUMN_HEIGHT }) as DOMRect;
  eventEl.getBoundingClientRect = () =>
    ({ top: eventBottom - 120, bottom: eventBottom, height: 120 }) as DOMRect;
  // The scroll port the old code found instead: strip + hours, top raised by the
  // strip. Present so the fixture is the real DOM shape, not just numbers.
  const scrollPortEl = document.createElement('div');
  scrollPortEl.append(dayColumnEl);
  Object.defineProperty(scrollPortEl, 'scrollHeight', { value: stripHeight + COLUMN_HEIGHT });
  scrollPortEl.getBoundingClientRect = () =>
    ({
      top: COLUMN_TOP - stripHeight,
      bottom: COLUMN_TOP + COLUMN_HEIGHT,
      height: stripHeight + COLUMN_HEIGHT
    }) as DOMRect;
  document.body.append(scrollPortEl);

  const event: CalendarEvent = {
    id: 'e1',
    title: 'Resize me',
    start: new Date(2026, 5, 15, 9, 0),
    end: new Date(2026, 5, 15, 10, 0),
    allDay: false
  };
  const onResizeEnd = vi.fn();
  resizableEvent({
    event,
    dayColumnEl,
    eventEl,
    startHour: 7,
    endHour: 20,
    onResizeEnd
  })(handle);

  return { handle, onResizeEnd };
}

function pointer(type: string, init: MouseEventInit = {}) {
  return new MouseEvent(type, { button: 0, ...init });
}

describe('resizableEvent teardown', () => {
  it('a completed resize resets the cursor and inline height and reports once', () => {
    const { handle, eventEl, onResizeEnd } = setup();

    handle.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    expect(document.body.style.cursor).toBe('row-resize');

    handle.dispatchEvent(pointer('pointermove', { clientY: 140 }));
    expect(eventEl.style.height).toBe('40px');

    handle.dispatchEvent(pointer('pointerup', { clientY: 140 }));
    expect(document.body.style.cursor).toBe('');
    expect(eventEl.style.height).toBe('');
    expect(onResizeEnd).toHaveBeenCalledTimes(1);
  });

  it('unmount during a live resize releases cursor, inline height, and listeners', () => {
    const { handle, eventEl, onResizeEnd, teardown } = setup();

    handle.dispatchEvent(pointer('pointerdown', { clientY: 100 }));
    handle.dispatchEvent(pointer('pointermove', { clientY: 140 }));
    expect(document.body.style.cursor).toBe('row-resize');
    expect(eventEl.style.height).toBe('40px');

    teardown();

    expect(document.body.style.cursor).toBe('');
    expect(eventEl.style.height).toBe('');

    // Listeners are gone: further moves must not re-apply the inline height,
    // and a late pointerup must not report a resize.
    handle.dispatchEvent(pointer('pointermove', { clientY: 200 }));
    expect(eventEl.style.height).toBe('');
    handle.dispatchEvent(pointer('pointerup', { clientY: 200 }));
    expect(onResizeEnd).not.toHaveBeenCalled();
  });
});

describe('resizableEvent geometry — the day column, not the scroll port (#96)', () => {
  it.each([
    ['week (78 px of pinned head + all-day strip above the hours)', 78],
    ['day (no strip: the hours start at the top of the port)', 0]
  ])('commits the hour the handle was dropped on — %s', (_label, stripHeight) => {
    const { handle, onResizeEnd } = setupWithGeometry(stripHeight);

    handle.dispatchEvent(pointer('pointerdown', { clientY: 340 }));
    handle.dispatchEvent(pointer('pointerup', { clientY: 340 }));

    expect(onResizeEnd).toHaveBeenCalledTimes(1);
    const newEnd = onResizeEnd.mock.calls[0][1] as Date;
    // 12:00 — read off the column, whose top edge IS 07:00 and whose height IS
    // the day. Against the scroll port the same drop gave 13:00 in the week
    // case: (78 + 240) / (78 + 624) × 780 min + 07:00 = 12:53, snapped to 13:00.
    expect([newEnd.getHours(), newEnd.getMinutes()]).toEqual([12, 0]);
  });
});
