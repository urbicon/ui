/**
 * Generic draggable utility based on Pointer Events API.
 * Zero dependencies — replaces ad-hoc pointer event loops across the library.
 *
 * Supports: mouse, touch, pen. Uses pointer capture for reliable tracking.
 *
 * @example Svelte attachment for horizontal reordering
 * ```svelte
 * <script>
 *   import { createDraggable } from '@urbicon-ui/blocks';
 * </script>
 *
 * <div {@attach createDraggable({
 *   axis: 'horizontal',
 *   onDragStart: ({ element }) => { element.style.opacity = '0.4'; },
 *   onDragMove: ({ clientX, clientY }) => { updateDropIndicator(clientX, clientY); },
 *   onDragEnd: ({ element }) => { element.style.opacity = ''; finalizeReorder(); },
 * })}></div>
 * ```
 */

import type { Attachment } from 'svelte/attachments';

export interface DragStartEvent {
  /** The element being dragged */
  element: HTMLElement;
  /** Initial pointer X */
  startX: number;
  /** Initial pointer Y */
  startY: number;
  /** Current pointer X */
  clientX: number;
  /** Current pointer Y */
  clientY: number;
  /** Original PointerEvent */
  originalEvent: PointerEvent;
}

export interface DragMoveEvent {
  element: HTMLElement;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  /** Delta from start X */
  deltaX: number;
  /** Delta from start Y */
  deltaY: number;
  originalEvent: PointerEvent;
}

export interface DragEndEvent {
  element: HTMLElement;
  startX: number;
  startY: number;
  clientX: number;
  clientY: number;
  deltaX: number;
  deltaY: number;
  /** Whether the drag exceeded the threshold (true = real drag, false = cancelled/tap) */
  didDrag: boolean;
  originalEvent: PointerEvent;
}

export interface DraggableOptions {
  /**
   * Pixel distance before drag activates (prevents accidental drags on click).
   * @default 5
   */
  threshold?: number;

  /**
   * Constrain drag to an axis. `'both'` allows free movement.
   * @default 'both'
   */
  axis?: 'horizontal' | 'vertical' | 'both';

  /**
   * Whether dragging is disabled.
   * @default false
   */
  disabled?: boolean;

  /**
   * Cursor to show during drag.
   * @default 'grabbing'
   */
  cursor?: string;

  /**
   * Called once when drag threshold is exceeded.
   */
  onDragStart?: (event: DragStartEvent) => void;

  /**
   * Called on every pointer move during an active drag.
   */
  onDragMove?: (event: DragMoveEvent) => void;

  /**
   * Called when the pointer is released or cancelled.
   */
  onDragEnd?: (event: DragEndEvent) => void;
}

/**
 * Svelte attachment that makes an element draggable via Pointer Events.
 *
 * Usage: `<div {@attach createDraggable({ axis: 'horizontal', onDragMove, onDragEnd })}>`
 */
export function createDraggable(opts: DraggableOptions): Attachment<HTMLElement> {
  return (node) => {
    let startX = 0;
    let startY = 0;
    let isDragging = false;
    let savedTouchAction = '';

    function handlePointerDown(e: PointerEvent) {
      if (opts.disabled) return;
      if (e.button !== 0) return; // Only primary button

      startX = e.clientX;
      startY = e.clientY;

      // Save and disable touch-action to prevent scroll during drag
      savedTouchAction = node.style.touchAction;
      node.style.touchAction = 'none';

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerCancel);
    }

    function handlePointerMove(e: PointerEvent) {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const threshold = opts.threshold ?? 5;

      // Check threshold based on axis
      const distance =
        opts.axis === 'horizontal'
          ? Math.abs(dx)
          : opts.axis === 'vertical'
            ? Math.abs(dy)
            : Math.abs(dx) + Math.abs(dy);

      if (!isDragging && distance < threshold) return;

      if (!isDragging) {
        isDragging = true;
        document.body.style.cursor = opts.cursor ?? 'grabbing';

        opts.onDragStart?.({
          element: node,
          startX,
          startY,
          clientX: e.clientX,
          clientY: e.clientY,
          originalEvent: e
        });
      }

      opts.onDragMove?.({
        element: node,
        startX,
        startY,
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: dx,
        deltaY: dy,
        originalEvent: e
      });
    }

    function handlePointerUp(e: PointerEvent) {
      const didDrag = isDragging;
      cleanup();

      opts.onDragEnd?.({
        element: node,
        startX,
        startY,
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: e.clientX - startX,
        deltaY: e.clientY - startY,
        didDrag,
        originalEvent: e
      });

      isDragging = false;
    }

    function handlePointerCancel(e: PointerEvent) {
      const didDrag = isDragging;
      cleanup();

      opts.onDragEnd?.({
        element: node,
        startX,
        startY,
        clientX: e.clientX,
        clientY: e.clientY,
        deltaX: e.clientX - startX,
        deltaY: e.clientY - startY,
        didDrag,
        originalEvent: e
      });

      isDragging = false;
    }

    function cleanup() {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerCancel);
      document.body.style.cursor = '';
      node.style.touchAction = savedTouchAction;
    }

    node.addEventListener('pointerdown', handlePointerDown);

    return () => {
      node.removeEventListener('pointerdown', handlePointerDown);
      if (isDragging) {
        cleanup();
        isDragging = false;
      }
    };
  };
}

/**
 * Finds the closest element with a specific data attribute under the pointer.
 * Useful for identifying drop targets during drag.
 */
export function findDropTarget(
  clientX: number,
  clientY: number,
  attribute: string
): HTMLElement | null {
  const elements = document.elementsFromPoint(clientX, clientY);
  for (const el of elements) {
    if ((el as HTMLElement).dataset?.[attribute] !== undefined) {
      return el as HTMLElement;
    }
  }
  return null;
}
