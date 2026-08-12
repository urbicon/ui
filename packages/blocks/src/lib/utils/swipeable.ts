import type { Attachment } from 'svelte/attachments';

interface SwipeableOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  enabled?: boolean;
  /**
   * The `touch-action` this attachment writes on the node — the browser half of
   * the gesture contract. The default `'pan-y'` reserves horizontal dragging for
   * the swipe: the browser pans vertically and leaves the horizontal axis to the
   * handlers below.
   *
   * Pass `null` **while** the node contains a horizontally scrollable box the
   * finger has to reach. Blink intersects `touch-action` down the tree, so a
   * `pan-y` ancestor makes an inner scroller unpannable by touch — the finger
   * would be reserved for a swipe the user never asked for while the content it
   * is trying to reach stays put. Left alone, the browser takes the drag for the
   * scroll and fires `pointercancel`, which this attachment already reads as
   * "not a swipe".
   *
   * `null` is not a way to have both. Measured in Chromium 141 (CDP touch
   * emulation, 390 px, an `overflow: auto` grid inside the swiping node): with
   * `touch-action` left at `auto` a horizontal drag ends in `pointercancel` in
   * every configuration — box overflowing on both axes, on the vertical one
   * only, and not at all — so no swipe is ever reported, whether or not there
   * was anything to scroll. With `pan-y` in force the pointer stream completes,
   * the swipe fires, and the inner box does not pan sideways. Hence: switch this
   * per *measured* overflow (CalendarWeekGrid does exactly that) instead of
   * passing `null` unconditionally, which trades the gesture away everywhere.
   * @default 'pan-y'
   */
  touchAction?: string | null;
}

/**
 * Svelte attachment for horizontal swipe detection using Pointer Events.
 * Works for both touch and mouse interactions.
 *
 * Usage: `<div {@attach swipeable({ onSwipeLeft, onSwipeRight, enabled })}>`
 */
export function swipeable(opts: SwipeableOptions): Attachment<HTMLElement> {
  return (node) => {
    let startX = 0;
    let startY = 0;
    let tracking = false;

    function onPointerDown(e: PointerEvent) {
      if (opts.enabled === false) return;
      // Only track primary pointer (ignore multi-touch)
      if (!e.isPrimary) return;
      startX = e.clientX;
      startY = e.clientY;
      tracking = true;
    }

    function onPointerUp(e: PointerEvent) {
      if (!tracking || !e.isPrimary) return;
      tracking = false;

      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      const threshold = opts.threshold ?? 50;

      // Ignore if vertical movement is too large (scroll intent)
      if (Math.abs(deltaY) > 80) return;
      // Ignore if horizontal movement is below threshold
      if (Math.abs(deltaX) < threshold) return;

      if (deltaX < 0) {
        opts.onSwipeLeft();
      } else {
        opts.onSwipeRight();
      }
    }

    function onPointerCancel() {
      tracking = false;
    }

    // Written on every (re-)attach, the reset to '' included: the option is
    // reactive at a call site that flips it with the layout, and a `pan-y` left
    // behind from the previous attach would keep the inner scroller unreachable.
    node.style.touchAction = opts.touchAction === undefined ? 'pan-y' : (opts.touchAction ?? '');
    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointerup', onPointerUp);
    node.addEventListener('pointercancel', onPointerCancel);

    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointerup', onPointerUp);
      node.removeEventListener('pointercancel', onPointerCancel);
    };
  };
}
