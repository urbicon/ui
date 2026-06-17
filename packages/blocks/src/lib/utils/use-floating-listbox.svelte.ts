import { autoUpdate, computePosition, flip, size as floatingSize, offset, shift } from './floating';

export interface FloatingListboxOptions {
  reference: () => HTMLElement | undefined;
  floating: () => HTMLElement | undefined;
  open: () => boolean;
  portal?: () => boolean;
  syncWidth?: () => boolean;
}

/**
 * Manages native popover state + Floating UI positioning for listbox-pattern
 * components (Select, Combobox). Handles show/hide, autoUpdate lifecycle,
 * position computation, and cleanup.
 *
 * `popover="manual"` puts the listbox in the browser top layer so overflow
 * clipping from parent containers cannot hide it. Manual mode (not auto)
 * keeps the component's own dismiss handlers in control.
 */
export function useFloatingListbox(opts: FloatingListboxOptions) {
  let cleanupPosition: (() => void) | undefined;

  $effect(() => {
    const ref = opts.reference();
    const floating = opts.floating();
    if (!ref || !floating) return;

    const isOpen = opts.open();
    const usePortal = opts.portal?.() ?? true;
    const syncWidth = opts.syncWidth?.() ?? true;

    if (!isOpen) {
      cleanupPosition?.();
      cleanupPosition = undefined;
      if (usePortal && floating.matches(':popover-open')) {
        try {
          floating.hidePopover();
        } catch {
          /* already hidden */
        }
      }
      return;
    }

    if (usePortal && !floating.matches(':popover-open')) {
      try {
        floating.showPopover();
      } catch {
        /* already shown or not supported */
      }
    }

    cleanupPosition?.();
    cleanupPosition = autoUpdate(ref, floating, () => {
      if (!ref || !floating) return;
      computePosition(ref, floating, {
        placement: 'bottom-start',
        strategy: usePortal ? 'fixed' : 'absolute',
        middleware: [
          offset(4),
          flip(),
          shift({ padding: 8 }),
          ...(syncWidth
            ? [
                floatingSize({
                  apply({ rects }) {
                    floating.style.width = `${rects.reference.width}px`;
                  }
                })
              ]
            : [])
        ]
      })
        .then(({ x, y }) => {
          if (!Number.isFinite(x) || !Number.isFinite(y)) return;
          Object.assign(floating.style, {
            left: `${x}px`,
            top: `${y}px`
          });
        })
        .catch(() => {});
    });

    return () => {
      cleanupPosition?.();
      cleanupPosition = undefined;
    };
  });
}
