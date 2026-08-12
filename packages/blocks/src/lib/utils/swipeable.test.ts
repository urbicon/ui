// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { swipeable } from './swipeable';

// The gesture contract of the swipe attachment — the half that is not a handler.
//
// `touch-action` decides whether the BROWSER or this attachment gets a
// horizontal drag, and it is inherited-by-intersection: a `pan-y` ancestor
// forbids the pan to every scroll container beneath it. Calendar's week view
// became one of those containers (issue #96), so the property had to become a
// decision the call site makes rather than a constant.
//
// An attachment is a plain `(node) => cleanup` function, so these run it
// directly — no component, no effect, no flush.
//
// What these tests can and cannot show: the handler half is here, the browser
// half is not. Whether Chromium cancels the pointer stream on a horizontal drag
// was measured separately (CDP touch emulation, 390 px — the numbers are in
// `swipeable`'s `touchAction` doc); the result is that `auto` cancels it in
// EVERY configuration, with or without anything to scroll, which is why the
// opt-out is a per-overflow decision rather than a constant.

function attach(opts: Parameters<typeof swipeable>[0]) {
  const node = document.createElement('div');
  const cleanup = swipeable(opts)(node);
  return { node, cleanup };
}

const noop = () => {};

/** pointerdown + pointerup past the 50 px default threshold. */
function drag(node: HTMLElement, from: number, to: number) {
  node.dispatchEvent(
    new PointerEvent('pointerdown', { isPrimary: true, clientX: from, clientY: 8 })
  );
  node.dispatchEvent(new PointerEvent('pointerup', { isPrimary: true, clientX: to, clientY: 8 }));
}

describe('swipeable — touch-action', () => {
  it('reserves the horizontal axis by default', () => {
    const { node } = attach({ onSwipeLeft: noop, onSwipeRight: noop });
    expect(node.style.touchAction).toBe('pan-y');
  });

  it('leaves the property empty for null — the opt-out for a scrolling child', () => {
    const { node } = attach({ onSwipeLeft: noop, onSwipeRight: noop, touchAction: null });
    expect(node.style.touchAction).toBe('');
    // Nothing is written where nothing was set: whatever CSS says still holds.
    expect(node.getAttribute('style')).toBeNull();
  });

  it('clears a value it wrote itself when the call site flips to null', () => {
    // The week view flips this with its layout — columns fit ⇒ `pan-y`, columns
    // overflow ⇒ null — so a `pan-y` left over from the previous attach would
    // keep the inner scroller unpannable for the rest of the session.
    const node = document.createElement('div');
    swipeable({ onSwipeLeft: noop, onSwipeRight: noop })(node);
    expect(node.style.touchAction).toBe('pan-y');

    swipeable({ onSwipeLeft: noop, onSwipeRight: noop, touchAction: null })(node);
    expect(node.style.touchAction).toBe('');
  });

  it('writes an explicit value verbatim', () => {
    const { node } = attach({ onSwipeLeft: noop, onSwipeRight: noop, touchAction: 'pan-x' });
    expect(node.style.touchAction).toBe('pan-x');
  });
});

describe('swipeable — a drag the browser takes is not a swipe', () => {
  it('fires the swipe when the pointer stream completes', () => {
    const onSwipeLeft = vi.fn();
    const { node } = attach({ onSwipeLeft, onSwipeRight: noop, touchAction: null });

    drag(node, 200, 40);

    expect(onSwipeLeft).toHaveBeenCalledTimes(1);
  });

  it('fires nothing after pointercancel — the signal that a scroll took over', () => {
    const onSwipeLeft = vi.fn();
    const onSwipeRight = vi.fn();
    const { node } = attach({ onSwipeLeft, onSwipeRight, touchAction: null });

    // This is the whole mechanism the week grid relies on: with touch-action
    // left alone, the browser takes the drag for the scroller and cancels the
    // pointer stream, so the same drag cannot ALSO page to the next week. (What
    // is asserted here is the handler's branch; that Chromium sends the cancel
    // is the measurement quoted at the top of this file.)
    node.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, clientX: 200, clientY: 8 })
    );
    node.dispatchEvent(new PointerEvent('pointercancel', { isPrimary: true }));
    node.dispatchEvent(new PointerEvent('pointerup', { isPrimary: true, clientX: 40, clientY: 8 }));

    expect(onSwipeLeft).not.toHaveBeenCalled();
    expect(onSwipeRight).not.toHaveBeenCalled();
  });

  it('stops listening after cleanup', () => {
    const onSwipeLeft = vi.fn();
    const { node, cleanup } = attach({ onSwipeLeft, onSwipeRight: noop });

    cleanup?.();
    drag(node, 200, 40);

    expect(onSwipeLeft).not.toHaveBeenCalled();
  });
});
