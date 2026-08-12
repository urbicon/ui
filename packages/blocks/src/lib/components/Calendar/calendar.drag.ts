/**
 * Drag & Drop system for Calendar events.
 * Uses native Pointer Events API — no external DnD library needed.
 */

import type { Attachment } from 'svelte/attachments';
import type { CalendarEvent } from './calendar.types';

export interface DragState {
  active: boolean;
  event: CalendarEvent | null;
  originDate: Date | null;
  ghostEl: HTMLElement | null;
}

export function createDragState(): DragState {
  return {
    active: false,
    event: null,
    originDate: null,
    ghostEl: null
  };
}

export interface DraggableEventOptions {
  event: CalendarEvent;
  disabled?: boolean;
  onDragStart?: () => void;
  onDragEnd?: (targetDate: Date | null) => void;
}

/**
 * Svelte attachment that makes a calendar event element draggable.
 * Uses Pointer Events for cross-device support (touch + mouse).
 *
 * Usage: `<div {@attach draggableEvent({ event, disabled, onDragEnd })}>`
 */
export function draggableEvent(opts: DraggableEventOptions): Attachment<HTMLElement> {
  return (node) => {
    let startX = 0;
    let startY = 0;
    let ghost: HTMLElement | null = null;
    let isDragging = false;
    const DRAG_THRESHOLD = 5; // px before drag activates

    function handlePointerDown(e: PointerEvent) {
      if (opts.disabled) return;
      // Only primary button (left click / touch)
      if (e.button !== 0) return;

      startX = e.clientX;
      startY = e.clientY;

      // Register on document so events arrive regardless of pointer position
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerCancel);
    }

    function handlePointerMove(e: PointerEvent) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      if (!isDragging && Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;

      if (!isDragging) {
        isDragging = true;
        opts.onDragStart?.();
        createGhost(e);
        node.style.opacity = '0.4';
        document.body.style.cursor = 'grabbing';
        // Highlight all drop targets
        document.querySelectorAll('[data-drop-target]').forEach((el) => {
          (el as HTMLElement).dataset.dropActive = 'true';
        });
      }

      if (ghost) {
        ghost.style.left = `${e.clientX - 60}px`;
        ghost.style.top = `${e.clientY - 12}px`;
      }

      // Highlight the drop target under the cursor
      updateDropHighlight(e);
    }

    function handlePointerUp(e: PointerEvent) {
      cleanup(e);

      if (!isDragging) return;

      const targetDate = getDropTargetDate(e);
      opts.onDragEnd?.(targetDate);
      isDragging = false;
    }

    function handlePointerCancel(e: PointerEvent) {
      cleanup(e);
      if (isDragging) {
        opts.onDragEnd?.(null);
        isDragging = false;
      }
    }

    function createGhost(e: PointerEvent) {
      ghost = document.createElement('div');
      ghost.textContent = opts.event.title;
      ghost.style.cssText = `
        position: fixed;
        z-index: 9999;
        padding: 4px 12px;
        border-radius: 6px;
        background: var(--color-primary, oklch(0.65 0.15 250));
        color: white;
        font-size: 0.75rem;
        font-weight: 500;
        pointer-events: none;
        white-space: nowrap;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        left: ${e.clientX - 60}px;
        top: ${e.clientY - 12}px;
      `;
      document.body.appendChild(ghost);
    }

    function updateDropHighlight(e: PointerEvent) {
      // Remove previous highlight
      document.querySelectorAll('[data-drop-hover]').forEach((el) => {
        (el as HTMLElement).style.removeProperty('box-shadow');
        delete (el as HTMLElement).dataset.dropHover;
      });

      // Find drop target under cursor
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elements) {
        if ((el as HTMLElement).dataset.dropTarget !== undefined) {
          (el as HTMLElement).dataset.dropHover = 'true';
          (el as HTMLElement).style.boxShadow =
            'inset 0 0 0 2px var(--color-primary, oklch(0.55 0.15 250))';
          break;
        }
      }
    }

    function getDropTargetDate(e: PointerEvent): Date | null {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      for (const el of elements) {
        const dateStr = (el as HTMLElement).dataset.date;
        if (dateStr) {
          const [y, m, d] = dateStr.split('-').map(Number);
          return new Date(y, m - 1, d);
        }
      }
      return null;
    }

    function cleanup(_e?: PointerEvent) {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      node.style.opacity = '';
      document.body.style.cursor = '';

      if (ghost) {
        ghost.remove();
        ghost = null;
      }

      // Remove all drop highlights
      document.querySelectorAll('[data-drop-active]').forEach((el) => {
        delete (el as HTMLElement).dataset.dropActive;
      });
      document.querySelectorAll('[data-drop-hover]').forEach((el) => {
        (el as HTMLElement).style.removeProperty('box-shadow');
        delete (el as HTMLElement).dataset.dropHover;
      });
    }

    node.addEventListener('pointerdown', handlePointerDown);
    node.style.touchAction = 'none'; // Prevent scroll during drag

    return () => {
      node.removeEventListener('pointerdown', handlePointerDown);
      // Clean up any in-progress drag on unmount
      if (isDragging) {
        cleanup();
        isDragging = false;
      }
    };
  };
}

// ─── Resize action ──────────────────────────────────────────

export interface ResizableEventOptions {
  /** The event being resized. */
  event: CalendarEvent;
  /**
   * The box that spans exactly `startHour`…`endHour` — the event's own day
   * column (`[data-day-column]` in CalendarTimeGrid), which is what pixels are
   * mapped to minutes against.
   *
   * Explicitly NOT the scroll port: since #96 that port also carries the week's
   * pinned head/all-day strip above the hours, so neither its top edge nor its
   * height is the day. Its height is read from `getBoundingClientRect()` rather
   * than `scrollHeight` for the same reason a column beats the port — an event
   * dragged past the bottom edge grows the scrollable overflow and would move
   * the denominator mid-gesture.
   */
  dayColumnEl: HTMLElement;
  /** The event block element whose height changes during resize. */
  eventEl: HTMLElement;
  /** Start hour of the time grid. */
  startHour: number;
  /** End hour of the time grid (exclusive). */
  endHour: number;
  /** Snap interval in minutes. @default 15 */
  snapMinutes?: number;
  /** Minimum event duration in minutes. @default 15 */
  minDuration?: number;
  /** Whether resize is disabled. */
  disabled?: boolean;
  /** Callback when resize completes. */
  onResizeEnd?: (event: CalendarEvent, newEnd: Date) => void;
}

/**
 * Svelte attachment for the resize handle at the bottom of a time-grid event.
 * Drag the handle up/down to change the event's duration, snapping to
 * a configurable grid (default 15 minutes).
 */
export function resizableEvent(opts: ResizableEventOptions): Attachment<HTMLElement> {
  return (handle) => {
    let isResizing = false;
    let startY = 0;
    let originalHeight = 0;

    function handlePointerDown(e: PointerEvent) {
      if (opts.disabled) return;
      if (e.button !== 0) return;
      e.stopPropagation(); // Prevent drag from starting

      isResizing = true;
      startY = e.clientY;
      originalHeight = opts.eventEl.getBoundingClientRect().height;

      handle.setPointerCapture(e.pointerId);
      handle.addEventListener('pointermove', handlePointerMove);
      handle.addEventListener('pointerup', handlePointerUp);
      handle.addEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = 'row-resize';
    }

    function handlePointerMove(e: PointerEvent) {
      if (!isResizing) return;

      const dy = e.clientY - startY;
      const newHeight = Math.max(originalHeight + dy, 10);

      // Apply the new height directly
      opts.eventEl.style.height = `${newHeight}px`;
    }

    function handlePointerUp(e: PointerEvent) {
      if (!isResizing) return;
      isResizing = false;

      handle.releasePointerCapture(e.pointerId);

      // Calculate new end time based on final position — measured BEFORE
      // cleanup(), which resets the inline height the calculation reads.
      const columnRect = opts.dayColumnEl.getBoundingClientRect();
      const eventRect = opts.eventEl.getBoundingClientRect();
      const gridTotalMinutes = (opts.endHour - opts.startHour) * 60;
      const columnHeight = columnRect.height;

      // Bottom of the event relative to the column's top edge = the start hour.
      // Both rects are viewport-relative, so a scrolled port cancels out and no
      // scroll term is needed.
      const eventBottomInGrid = eventRect.bottom - columnRect.top;
      const bottomPercent = eventBottomInGrid / columnHeight;
      const bottomMinutes = opts.startHour * 60 + bottomPercent * gridTotalMinutes;

      // Snap to interval
      const snap = opts.snapMinutes ?? 15;
      const snappedMinutes = Math.round(bottomMinutes / snap) * snap;

      // Enforce minimum duration
      const minDuration = opts.minDuration ?? 15;
      const eventStartMinutes = opts.event.start.getHours() * 60 + opts.event.start.getMinutes();
      const finalMinutes = Math.max(snappedMinutes, eventStartMinutes + minDuration);

      // Clamp to grid bounds
      const clampedMinutes = Math.min(finalMinutes, opts.endHour * 60);

      // Compute new end date
      const newEnd = new Date(opts.event.start);
      newEnd.setHours(Math.floor(clampedMinutes / 60), clampedMinutes % 60, 0, 0);

      cleanup();

      opts.onResizeEnd?.(opts.event, newEnd);
    }

    // Teardown of everything a live resize holds: document-level cursor, the
    // move/up/cancel listeners, and the event block's inline height (the parent
    // re-renders the committed height from props).
    function cleanup() {
      handle.removeEventListener('pointermove', handlePointerMove);
      handle.removeEventListener('pointerup', handlePointerUp);
      handle.removeEventListener('pointercancel', handlePointerUp);
      document.body.style.cursor = '';
      opts.eventEl.style.height = '';
    }

    handle.addEventListener('pointerdown', handlePointerDown);
    handle.style.touchAction = 'none';

    return () => {
      handle.removeEventListener('pointerdown', handlePointerDown);
      // Clean up any in-progress resize on unmount (mirrors draggableEvent) —
      // otherwise the row-resize cursor and inline height would leak.
      if (isResizing) {
        cleanup();
        isResizing = false;
      }
    };
  };
}
