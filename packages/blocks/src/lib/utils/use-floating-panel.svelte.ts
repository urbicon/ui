import {
  autoUpdate,
  computePosition,
  flip,
  size as floatingSize,
  offset,
  type Placement,
  shift
} from './floating';

export interface FloatingPanelOptions {
  /** The anchor the panel positions against. */
  reference: () => HTMLElement | null | undefined;
  /** The floating panel element. */
  floating: () => HTMLElement | null | undefined;
  /** Whether the panel is currently open. */
  open: () => boolean;
  /**
   * Render in the browser top layer via the native popover API (default).
   * `false` keeps the panel in normal DOM flow (`position: absolute`) for
   * nested-overlay scenarios — the caller drives visibility via `display`.
   */
  portal?: () => boolean;
  /** Preferred placement. @default 'bottom-start' */
  placement?: () => Placement;
  /** Main-axis gap between anchor and panel, in px. @default 4 */
  offsetDistance?: () => number;
  /** Viewport padding kept by the shift middleware, in px. @default 8 */
  shiftPadding?: () => number;
  /** Clamp the panel width to exactly the anchor width. @default false */
  syncWidth?: () => boolean;
  /** Clamp the panel's *min*-width to the anchor width (it may still grow). @default false */
  syncMinWidth?: () => boolean;
}

/**
 * Manages native popover state + Floating UI positioning for anchored overlay
 * panels (Select, Combobox, Popover, and through it Menu). Handles show/hide,
 * the autoUpdate lifecycle, position computation, a keyboard-aware height cap,
 * and cleanup — one positioning codepath shared across every overlay so an
 * iOS/visualViewport or flip/shift fix lands everywhere at once.
 *
 * `popover` (top layer) keeps the panel above any `overflow` clipping from
 * parent containers. `popover="manual"` (set by the caller in markup) leaves
 * the caller's own dismiss handlers in control; this helper only drives
 * `showPopover()`/`hidePopover()` and never reads the dismiss mode.
 *
 * The Floating-UI `size` middleware feeds the room actually left between the
 * anchor and the (visual) viewport edge into `--blocks-overlay-available-height`.
 * Variants cap height via `max-h-[min(<design-cap>,var(--…,100dvh))]`, so the
 * static design cap stays in CSS and the panel only ever shrinks to fit — and
 * recovers once room is restored (e.g. the iOS keyboard closes).
 */
export function useFloatingPanel(opts: FloatingPanelOptions) {
  let cleanupPosition: (() => void) | undefined;

  $effect(() => {
    const ref = opts.reference();
    const floating = opts.floating();
    const isOpen = opts.open();
    const usePortal = opts.portal?.() ?? true;
    const placement = opts.placement?.() ?? 'bottom-start';
    const offsetDistance = opts.offsetDistance?.() ?? 4;
    const shiftPadding = opts.shiftPadding?.() ?? 8;
    const syncWidth = opts.syncWidth?.() ?? false;
    const syncMinWidth = opts.syncMinWidth?.() ?? false;

    // No panel element → nothing to show, hide, or position.
    if (!floating) return;

    // Closed — OR open but the anchor has gone (e.g. a conditionally-rendered
    // trigger unmounted while the panel was up). Either way tear down and hide
    // so a portalled panel can't linger, unanchored, in the top layer. The
    // hide path deliberately needs only `floating`, not `ref`.
    if (!isOpen || !ref) {
      cleanupPosition?.();
      cleanupPosition = undefined;
      // Drop the keyboard-aware height clamp so the next open re-measures from
      // the full design cap instead of inheriting a stale value.
      floating.style.removeProperty('--blocks-overlay-available-height');
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
      computePosition(ref, floating, {
        placement,
        strategy: usePortal ? 'fixed' : 'absolute',
        middleware: [
          offset(offsetDistance),
          flip(),
          shift({ padding: shiftPadding }),
          floatingSize({
            apply({ availableHeight, rects }) {
              // Cap the panel to the room actually left between the anchor and
              // the (visual) viewport edge — decisive on iOS, where the
              // keyboard shrinks the visualViewport. Exposed as a CSS var that
              // the variant feeds into `max-h-[min(<cap>,var(--…))]`, so the
              // design token stays the upper bound while this tracks the live
              // available height (and recovers when room is restored).
              floating.style.setProperty(
                '--blocks-overlay-available-height',
                `${Math.max(0, Math.round(availableHeight))}px`
              );
              // `syncWidth` clamps the panel to the anchor width exactly
              // (Select/Combobox semantics — items wider than the field
              // truncate or wrap). `syncMinWidth` is the looser Menu-style
              // variant: panel ≥ anchor width, but content is free to grow it.
              // Hard sync wins if both are set; otherwise width resets so a
              // toggled-off sync cannot leave a stale inline width behind.
              floating.style.width = syncWidth ? `${rects.reference.width}px` : '';
              floating.style.minWidth =
                !syncWidth && syncMinWidth ? `${rects.reference.width}px` : '';
            }
          })
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
