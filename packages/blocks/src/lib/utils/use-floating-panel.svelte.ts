import {
  autoUpdate,
  computePosition,
  flip,
  size as floatingSize,
  offset,
  type Placement,
  shift
} from './floating';
import { isAnchoredInModalDialog } from './overlay';

export interface FloatingPanelOptions {
  /** The anchor the panel positions against. */
  reference: () => HTMLElement | null | undefined;
  /** The floating panel element. */
  floating: () => HTMLElement | null | undefined;
  /** Whether the panel is currently open. */
  open: () => boolean;
  /**
   * Caller hint for top-layer promotion via the native popover API (default
   * `true`). `false` forces the panel into normal DOM flow (`position:
   * absolute`) for nested-overlay scenarios (e.g. a Menu/Select inside a
   * Popover) — the caller drives visibility via `display`.
   *
   * Even when `true`, the panel is automatically kept OUT of the top layer
   * while it sits inside an open modal `<dialog>` — it then renders
   * `position: fixed` within the dialog's own subtree, because a second
   * top-layer element over a modal dialog is invisible on iOS/WebKit
   * (Codeberg #23). Read the effective state from the returned
   * `topLayer`/`strategy`.
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
 * Effective render mode of a floating panel, returned by {@link useFloatingPanel}
 * so the calling component's markup stays in lockstep with the positioning
 * effect — both read the same derived values, so the `popover` attribute and the
 * `showPopover()` decision can never diverge.
 */
export interface FloatingPanelState {
  /**
   * `true` when the panel is promoted to the browser top layer (the markup sets
   * the `popover` attribute and the effect calls `showPopover()`); `false` when
   * it renders in place — inside a modal `<dialog>`, or the explicit
   * `portal=false` inline mode.
   */
  readonly topLayer: boolean;
  /** CSS positioning strategy the panel element must match (`position: <strategy>`). */
  readonly strategy: 'fixed' | 'absolute';
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
 * Top-layer promotion is automatic but conditional: the helper skips it (and
 * returns `topLayer: false`) when the anchor sits inside an open modal
 * `<dialog>`, where a second top-layer element is invisible on iOS/WebKit
 * (Codeberg #23) — the panel then renders `position: fixed` in place. Callers
 * mirror the returned `topLayer`/`strategy` in their markup via
 * {@link floatingPanelStyle}.
 *
 * The Floating-UI `size` middleware feeds the room actually left between the
 * anchor and the (visual) viewport edge into `--blocks-overlay-available-height`.
 * Variants cap height via `max-h-[min(<design-cap>,var(--…,100dvh))]`, so the
 * static design cap stays in CSS and the panel only ever shrinks to fit — and
 * recovers once room is restored (e.g. the iOS keyboard closes).
 */
export function useFloatingPanel(opts: FloatingPanelOptions): FloatingPanelState {
  let cleanupPosition: (() => void) | undefined;

  // Effective render mode — derived synchronously, never via an $effect-set
  // $state. A lagged mode would leave the element carrying a stale
  // `popover="manual"` for one frame and re-trigger the exact WebKit
  // double-top-layer bug this guards against (Codeberg #23).
  const inModalDialog = $derived(opts.open() ? isAnchoredInModalDialog(opts.reference()) : false);
  const portalHint = $derived(opts.portal?.() ?? true);
  // Top layer (native popover) only when the caller opted in AND the anchor is
  // not nested in a modal dialog. `strategy` stays `fixed` for the dialog case
  // so the panel escapes the dialog body's overflow clipping; only the explicit
  // inline mode (`portal=false`) falls back to `absolute`.
  const topLayer = $derived(portalHint && !inModalDialog);
  const strategy = $derived<'fixed' | 'absolute'>(portalHint ? 'fixed' : 'absolute');

  $effect(() => {
    const ref = opts.reference();
    const floating = opts.floating();
    const isOpen = opts.open();
    const useTopLayer = topLayer;
    const positionStrategy = strategy;
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
      // Guard on the live `:popover-open` state only (not the current mode):
      // a panel that was promoted to the top layer must still be torn down even
      // if its mode has since flipped to `fixed`/`inline`.
      if (floating.matches(':popover-open')) {
        try {
          floating.hidePopover();
        } catch (err) {
          // Pre-check ruled out "already hidden": a real failure here is a
          // detached node or a consumer-overridden popover attribute. Surface
          // it (as Tooltip/Guide do) instead of leaving the panel stuck in the
          // top layer with no diagnostics.
          console.warn('[useFloatingPanel] hidePopover failed', err);
        }
      }
      return;
    }

    if (useTopLayer && !floating.matches(':popover-open')) {
      try {
        floating.showPopover();
      } catch (err) {
        // Pre-check ruled out "already shown": a real failure here (missing
        // Popover API on a legacy browser, a detached node, or a consumer-
        // overridden popover attribute) would leave the panel stuck
        // `display:none` via the UA rule with no diagnostics — exactly the
        // silent "overlay never opens" class of bug. Surface it for telemetry.
        console.warn('[useFloatingPanel] showPopover failed', err);
      }
    }

    cleanupPosition?.();
    cleanupPosition = autoUpdate(ref, floating, () => {
      computePosition(ref, floating, {
        placement,
        strategy: positionStrategy,
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
        // Mirrors Tooltip/Guide: middleware can throw synchronously on a
        // detached node; surface it instead of swallowing it silently.
        .catch((err) => console.warn('[useFloatingPanel] computePosition failed', err));
    });

    return () => {
      cleanupPosition?.();
      cleanupPosition = undefined;
    };
  });

  return {
    get topLayer() {
      return topLayer;
    },
    get strategy() {
      return strategy;
    }
  };
}

/**
 * Inline style for a panel driven by {@link useFloatingPanel}. Pins the
 * positioning coordinate system Floating UI expects — `position` matches the
 * strategy, `margin:0; inset:auto` neutralise the UA popover centering — and,
 * when the panel is NOT top-layer-promoted, drives visibility from `open` (the
 * UA `[popover]:not(:popover-open){display:none}` rule only applies while the
 * `popover` attribute is present, which the in-place modes omit).
 *
 * `extra` is prepended so a caller's own declarations (e.g. a consumer `style`
 * prop, or `overflow-y:auto`) stay overridable by the load-bearing positioning
 * tokens that follow.
 */
export function floatingPanelStyle(panel: FloatingPanelState, open: boolean, extra = ''): string {
  const positioning = `position: ${panel.strategy}; margin: 0; inset: auto;`;
  const hidden = !panel.topLayer && !open ? ' display: none;' : '';
  return `${extra}${positioning}${hidden}`;
}
