// ─── Types ───────────────────────────────────────────────────────────────────

export type Side = 'top' | 'right' | 'bottom' | 'left';
export type Alignment = 'start' | 'end';
export type Placement = Side | `${Side}-${Alignment}`;
export type Strategy = 'absolute' | 'fixed';

export interface Middleware {
  name: string;
  fn(state: MiddlewareState): MiddlewareReturn;
}

export interface MiddlewareState {
  x: number;
  y: number;
  placement: Placement;
  initialPlacement: Placement;
  rects: { reference: DOMRect; floating: { width: number; height: number } };
  elements: { reference: HTMLElement; floating: HTMLElement };
  middlewareData: Record<string, unknown>;
  strategy: Strategy;
}

export interface MiddlewareReturn {
  x?: number;
  y?: number;
  data?: Record<string, unknown>;
  reset?: boolean | { placement?: Placement };
}

export interface ComputePositionReturn {
  x: number;
  y: number;
  placement: Placement;
  strategy: Strategy;
  middlewareData: Record<string, unknown>;
}

// ─── Geometry Helpers ────────────────────────────────────────────────────────

function getSide(placement: Placement): Side {
  return placement.split('-')[0] as Side;
}

function getAlignment(placement: Placement): Alignment | undefined {
  return placement.split('-')[1] as Alignment | undefined;
}

function getOppositeSide(side: Side): Side {
  return { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] as Side;
}

function getSideAxis(side: Side): 'x' | 'y' {
  return side === 'top' || side === 'bottom' ? 'y' : 'x';
}

function getBaseCoords(
  ref: DOMRect,
  floating: { width: number; height: number },
  placement: Placement
): { x: number; y: number } {
  const side = getSide(placement);
  const alignment = getAlignment(placement);

  const centerX = ref.left + ref.width / 2 - floating.width / 2;
  const centerY = ref.top + ref.height / 2 - floating.height / 2;

  let x: number;
  let y: number;

  switch (side) {
    case 'top':
      x = centerX;
      y = ref.top - floating.height;
      break;
    case 'bottom':
      x = centerX;
      y = ref.bottom;
      break;
    case 'left':
      x = ref.left - floating.width;
      y = centerY;
      break;
    case 'right':
      x = ref.right;
      y = centerY;
      break;
  }

  if (alignment) {
    const isVertical = side === 'top' || side === 'bottom';
    if (isVertical) {
      x = alignment === 'start' ? ref.left : ref.right - floating.width;
    } else {
      y = alignment === 'start' ? ref.top : ref.bottom - floating.height;
    }
  }

  return { x, y };
}

/**
 * Viewport offset of a `position: fixed` element's *actual* containing block,
 * measured by momentarily pinning it to (0,0) and reading where that lands.
 *
 * It is (0,0) when the element is genuinely viewport-fixed (the common case, so
 * compensation is a no-op there). It is non-zero when a transformed / filtered /
 * contained ancestor establishes the containing block — notably a modal
 * `<dialog>` nested inside an off-canvas sidebar on iOS/WebKit, which (unlike
 * Chromium/Firefox) does NOT re-anchor the dialog's fixed descendants to the
 * viewport (Codeberg #23). Measuring rather than assuming keeps positioning
 * correct on every engine without UA sniffing. The probe is synchronous (set →
 * read → restore in one frame), so it never paints an intermediate (0,0) state.
 */
function fixedOriginOffset(floating: HTMLElement): { x: number; y: number } {
  const prevLeft = floating.style.left;
  const prevTop = floating.style.top;
  floating.style.left = '0px';
  floating.style.top = '0px';
  const origin = floating.getBoundingClientRect();
  floating.style.left = prevLeft;
  floating.style.top = prevTop;
  return { x: origin.left, y: origin.top };
}

function viewportToLocal(
  floating: HTMLElement,
  x: number,
  y: number,
  strategy: Strategy
): { x: number; y: number } {
  if (strategy === 'fixed') {
    // Measure where the element's OWN containing block actually sits and
    // compensate — never assume `position: fixed` (or the top layer) equals the
    // viewport. The probe self-corrects for every case:
    //   • genuinely viewport-fixed (desktop)               → origin (0,0), no-op
    //   • non-top-layer panel under a transformed ancestor → origin = ancestor
    //   • TOP-LAYER popover on iOS with the keyboard open   → the popover is
    //     anchored to the LAYOUT viewport, which getBoundingClientRect reports
    //     offset by `visualViewport.offsetTop`; the probe reads (0, -offsetTop)
    //     and compensates, so the panel lands on its anchor instead of floating
    //     that far above the visible area (Codeberg #23).
    // Earlier revisions special-cased `:popover-open` to skip this — that wrongly
    // assumed top-layer == viewport-fixed and stranded keyboard-shifted popovers
    // (and risked a SyntaxError on engines without `:popover-open`).
    const origin = fixedOriginOffset(floating);
    return { x: x - origin.x, y: y - origin.y };
  }

  const offsetParent = floating.offsetParent as HTMLElement | null;
  if (!offsetParent) return { x, y };

  const parentRect = offsetParent.getBoundingClientRect();
  return {
    x: x - parentRect.left + offsetParent.scrollLeft,
    y: y - parentRect.top + offsetParent.scrollTop
  };
}

function detectOverflow(state: MiddlewareState, padding = 0) {
  const vh = window.visualViewport?.height ?? window.innerHeight;
  const vw = window.visualViewport?.width ?? window.innerWidth;
  return {
    top: padding - state.y,
    bottom: state.y + state.rects.floating.height - vh + padding,
    left: padding - state.x,
    right: state.x + state.rects.floating.width - vw + padding
  };
}

// ─── computePosition ─────────────────────────────────────────────────────────

export function computePosition(
  reference: HTMLElement,
  floating: HTMLElement,
  options: {
    placement?: Placement;
    strategy?: Strategy;
    middleware?: Middleware[];
  } = {}
): Promise<ComputePositionReturn> {
  const {
    placement: initialPlacement = 'bottom',
    strategy = 'absolute',
    middleware = []
  } = options;

  let placement = initialPlacement;
  let refRect = reference.getBoundingClientRect();
  const floatingSize = { width: floating.offsetWidth, height: floating.offsetHeight };
  let { x, y } = getBaseCoords(refRect, floatingSize, placement);
  const middlewareData: Record<string, unknown> = {};

  let resetCount = 0;

  for (let i = 0; i < middleware.length; i++) {
    const mw = middleware[i];
    const state: MiddlewareState = {
      x,
      y,
      placement,
      initialPlacement,
      rects: { reference: refRect, floating: floatingSize },
      elements: { reference, floating },
      middlewareData,
      strategy
    };

    const result = mw.fn(state);
    if (result.x != null) x = result.x;
    if (result.y != null) y = result.y;
    if (result.data) middlewareData[mw.name] = result.data;

    if (result.reset && resetCount < 10) {
      resetCount++;
      if (typeof result.reset === 'object' && result.reset.placement) {
        placement = result.reset.placement;
      }
      refRect = reference.getBoundingClientRect();
      floatingSize.width = floating.offsetWidth;
      floatingSize.height = floating.offsetHeight;
      ({ x, y } = getBaseCoords(refRect, floatingSize, placement));
      i = -1;
    }
  }

  const local = viewportToLocal(floating, x, y, strategy);

  return Promise.resolve({
    x: local.x,
    y: local.y,
    placement,
    strategy,
    middlewareData
  });
}

// ─── Middleware: offset ───────────────────────────────────────────────────────

export function offset(value: number | { mainAxis?: number; crossAxis?: number }): Middleware {
  return {
    name: 'offset',
    fn(state) {
      const mainAxis = typeof value === 'number' ? value : (value.mainAxis ?? 0);
      const crossAxis = typeof value === 'number' ? 0 : (value.crossAxis ?? 0);
      const side = getSide(state.placement);
      const axis = getSideAxis(side);

      const dx = axis === 'y' ? crossAxis : side === 'left' ? -mainAxis : mainAxis;
      const dy = axis === 'y' ? (side === 'top' ? -mainAxis : mainAxis) : crossAxis;

      return { x: state.x + dx, y: state.y + dy, data: { x: dx, y: dy } };
    }
  };
}

// ─── Middleware: flip ─────────────────────────────────────────────────────────

export function flip(options?: { padding?: number }): Middleware {
  const padding = options?.padding ?? 0;

  return {
    name: 'flip',
    fn(state) {
      const flipData = state.middlewareData.flip as { flipped?: boolean } | undefined;
      if (flipData?.flipped) return {};

      const overflow = detectOverflow(state, padding);
      const side = getSide(state.placement);
      const alignment = getAlignment(state.placement);
      const axis = getSideAxis(side);

      const mainOverflow =
        axis === 'y'
          ? side === 'top'
            ? overflow.top
            : overflow.bottom
          : side === 'left'
            ? overflow.left
            : overflow.right;

      if (mainOverflow > 0) {
        const ref = state.rects.reference;
        const vh = window.visualViewport?.height ?? window.innerHeight;
        const vw = window.visualViewport?.width ?? window.innerWidth;

        const spaceOnSide =
          axis === 'y'
            ? side === 'bottom'
              ? vh - ref.top - ref.height
              : ref.top
            : side === 'right'
              ? vw - ref.left - ref.width
              : ref.left;

        const spaceOnOpposite =
          axis === 'y'
            ? side === 'bottom'
              ? ref.top
              : vh - ref.top - ref.height
            : side === 'right'
              ? ref.left
              : vw - ref.left - ref.width;

        if (spaceOnOpposite > spaceOnSide) {
          const opposite = getOppositeSide(side);
          const newPlacement = alignment ? (`${opposite}-${alignment}` as Placement) : opposite;
          return { data: { flipped: true }, reset: { placement: newPlacement } };
        }
      }

      return {};
    }
  };
}

// ─── Middleware: shift ────────────────────────────────────────────────────────

export function shift(options?: { padding?: number }): Middleware {
  const padding = options?.padding ?? 0;

  return {
    name: 'shift',
    fn(state) {
      const overflow = detectOverflow(state, padding);
      const axis = getSideAxis(getSide(state.placement));
      let { x, y } = state;

      if (axis === 'y') {
        if (overflow.left > 0) x += overflow.left;
        else if (overflow.right > 0) x -= overflow.right;
      } else {
        if (overflow.top > 0) y += overflow.top;
        else if (overflow.bottom > 0) y -= overflow.bottom;
      }

      return { x, y, data: { x: x - state.x, y: y - state.y } };
    }
  };
}

// ─── Middleware: arrow ────────────────────────────────────────────────────────

export function arrow(options: { element: HTMLElement; padding?: number }): Middleware {
  return {
    name: 'arrow',
    fn(state) {
      const { element: arrowEl, padding = 0 } = options;
      const side = getSide(state.placement);
      const isVertical = side === 'top' || side === 'bottom';

      const arrowLen = isVertical ? arrowEl.offsetWidth : arrowEl.offsetHeight;
      const refCenter = isVertical
        ? state.rects.reference.left + state.rects.reference.width / 2
        : state.rects.reference.top + state.rects.reference.height / 2;
      const floatingStart = isVertical ? state.x : state.y;
      const floatingLen = isVertical ? state.rects.floating.width : state.rects.floating.height;

      const center = refCenter - floatingStart;
      const min = padding;
      const max = floatingLen - arrowLen - padding;
      const arrowPos = Math.max(min, Math.min(center - arrowLen / 2, max));

      return {
        data: {
          x: isVertical ? arrowPos : undefined,
          y: isVertical ? undefined : arrowPos
        }
      };
    }
  };
}

// ─── Middleware: size ─────────────────────────────────────────────────────────

export function size(options: {
  apply: (args: MiddlewareState & { availableWidth: number; availableHeight: number }) => void;
}): Middleware {
  return {
    name: 'size',
    fn(state) {
      const overflow = detectOverflow(state);
      const side = getSide(state.placement);
      const vertical = side === 'top' || side === 'bottom';

      // Room in the placement's MAIN axis is measured anchor → viewport edge:
      // `dimension - overflow[side]` cancels the floating element's own
      // dimension, so the value reflects true available room and grows back
      // once space is restored. Subtracting the *clamped* overflow of both
      // edges instead would only ever ratchet down — a one-way "latch" that
      // keeps the panel short after the iOS keyboard closes. The CROSS axis
      // keeps the "what currently fits between both edges" measure.
      const availableWidth = vertical
        ? state.rects.floating.width - Math.max(0, overflow.left) - Math.max(0, overflow.right)
        : state.rects.floating.width - overflow[side];
      const availableHeight = vertical
        ? state.rects.floating.height - overflow[side]
        : state.rects.floating.height - Math.max(0, overflow.top) - Math.max(0, overflow.bottom);

      options.apply({ ...state, availableWidth, availableHeight });

      const newW = state.elements.floating.offsetWidth;
      const newH = state.elements.floating.offsetHeight;
      if (newW !== state.rects.floating.width || newH !== state.rects.floating.height) {
        return { reset: true };
      }
      return {};
    }
  };
}

// ─── autoUpdate ──────────────────────────────────────────────────────────────

export function autoUpdate(
  reference: HTMLElement,
  floating: HTMLElement,
  callback: () => void
): () => void {
  const cleanups: (() => void)[] = [];

  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => callback());
    ro.observe(reference);
    ro.observe(floating);
    cleanups.push(() => ro.disconnect());
  }

  function getScrollAncestors(el: HTMLElement): (HTMLElement | Window)[] {
    const ancestors: (HTMLElement | Window)[] = [];
    let current = el.parentElement;
    while (current) {
      const { overflow, overflowX, overflowY } = getComputedStyle(current);
      if (/auto|scroll|overlay|hidden/.test(overflow + overflowX + overflowY)) {
        ancestors.push(current);
      }
      current = current.parentElement;
    }
    ancestors.push(window);
    return ancestors;
  }

  const scrollAncestors = new Set([
    ...getScrollAncestors(reference),
    ...getScrollAncestors(floating)
  ]);

  for (const ancestor of scrollAncestors) {
    ancestor.addEventListener('scroll', callback, { passive: true });
    cleanups.push(() => ancestor.removeEventListener('scroll', callback));
  }

  window.addEventListener('resize', callback);
  cleanups.push(() => window.removeEventListener('resize', callback));

  // iOS Safari resizes and offsets the *visual* viewport when the on-screen
  // keyboard opens (and during pinch-zoom / overscroll) WITHOUT firing a
  // `window` 'resize' or 'scroll'. A `position: fixed` overlay would otherwise
  // stay pinned to stale coordinates — visibly detaching from its anchor and
  // drifting as the page settles. Tracking the visualViewport keeps anchored
  // overlays glued to their reference on touch devices.
  const vv = window.visualViewport;
  if (vv) {
    vv.addEventListener('resize', callback);
    vv.addEventListener('scroll', callback, { passive: true });
    cleanups.push(() => {
      vv.removeEventListener('resize', callback);
      vv.removeEventListener('scroll', callback);
    });
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}
