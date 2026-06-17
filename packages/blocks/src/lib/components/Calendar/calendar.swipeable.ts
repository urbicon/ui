import type { Attachment } from 'svelte/attachments';

interface SwipeableOptions {
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
  threshold?: number;
  enabled?: boolean;
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

    node.style.touchAction = 'pan-y';
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
