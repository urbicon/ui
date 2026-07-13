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
  const gridEl = document.createElement('div');
  document.body.append(gridEl, eventEl, handle);
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
    gridEl,
    eventEl,
    startHour: 7,
    endHour: 20,
    onResizeEnd
  })(handle) as () => void;

  return { handle, eventEl, onResizeEnd, teardown };
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
