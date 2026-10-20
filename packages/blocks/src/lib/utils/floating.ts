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
  /** Where the floating element can be seen, in viewport coordinates — see {@link clippingBoundary}. */
  boundary: Boundary;
}

/** A viewport-space rectangle, edges only. */
export interface Boundary {
  top: number;
  right: number;
  bottom: number;
  left: number;
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
  const prevOrigin = floating.style.transformOrigin;
  floating.style.left = '0px';
  floating.style.top = '0px';
  // Pin the transform origin to the panel's own top-left corner for the length
  // of the probe (#197).
  //
  // `getBoundingClientRect` reports the PAINTED box, and the panel is mid-enter
  // when it is first positioned: `popoverMotion` opens from `scale(0.98)` via
  // `@starting-style`. Around the default centre origin a 2 % shrink pulls that
  // painted box inward by 1 % of the panel's own size, `viewportToLocal`
  // subtracts the inflated origin from the coordinates, and the panel lands that
  // far up and to the left of its anchor — measured 1.44 px and 2.18 px on a
  // 144×218 menu, i.e. the reported "two pixels too close and a tick to the
  // left". Scaling about the top-left corner leaves that corner where layout put
  // it, whatever the scale factor, so the probe reads the LAYOUT origin.
  //
  // It has to be the ORIGIN that moves, not the transform: a running CSS
  // transition outranks every author declaration including inline styles, so
  // writing `scale: none` here changes the transition's target and leaves the
  // current painted value exactly where it was (verified — the probe still read
  // 0.98 with `style.scale === 'none'` set). `transform-origin` is not among the
  // properties the library's panel motion transitions, so writing it lands at
  // once.
  //
  // Two things this does not cover, both only reachable from outside the
  // library: a caller that transitions `transform-origin` itself (an `unstyled`
  // Popover with hand-built motion) puts the origin write back under the same
  // rule and the error returns; and the correction is a scale correction — for a
  // ROTATED panel the bounding box is not the corner, so it would still be
  // measured wrong. No motion in the library does either.
  //
  // Ancestor transforms — the containing-block shift this probe exists to find —
  // are unaffected either way; they are not on this element.
  floating.style.transformOrigin = '0 0';
  const origin = floating.getBoundingClientRect();
  floating.style.left = prevLeft;
  floating.style.top = prevTop;
  floating.style.transformOrigin = prevOrigin;
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

// Anything but `visible` clips its axis. The axes are read one by one:
// `overflow-x: clip` leaves `overflow-y: visible`, unlike `hidden`, which
// computes a `visible` partner to `auto`.
const CLIPPING_OVERFLOW = /auto|scroll|overlay|hidden|clip/;

function matchesSafely(el: Element, selector: string): boolean {
  try {
    return el.matches(selector);
  } catch {
    // An engine that does not know the pseudo-class has no such state either.
    return false;
  }
}

function inTopLayer(el: Element): boolean {
  return matchesSafely(el, ':popover-open') || matchesSafely(el, ':modal');
}

/**
 * Whether `style` makes its element the containing block of positioned
 * descendants on its own, with no `position` of its own needed — the list
 * `position: fixed` escapes everything but. `container-type` is not on it:
 * it does not contain a fixed child (measured in Chromium).
 */
function establishesContainingBlock(style: CSSStyleDeclaration): boolean {
  const transformLike = [
    style.transform,
    style.translate,
    style.rotate,
    style.scale,
    style.perspective,
    style.filter,
    style.backdropFilter
  ];
  return (
    transformLike.some((value) => !!value && value !== 'none') ||
    style.transformStyle === 'preserve-3d' ||
    /layout|paint|strict|content/.test(style.contain ?? '') ||
    /auto|hidden/.test(style.contentVisibility ?? '') ||
    /transform|translate|rotate|scale|perspective|filter/.test(style.willChange ?? '')
  );
}

/**
 * The containing block of an out-of-flow element: an `Element`, `null` for the
 * viewport, or `undefined` when `el` is in flow and every ancestor's overflow
 * applies to it.
 */
function containingBlockOf(el: Element, position: string): Element | null | undefined {
  if (position !== 'absolute' && position !== 'fixed') return undefined;
  // The top layer is laid out against the viewport whatever its ancestors say,
  // and so is anything inside it that nothing in between contains: an ancestor
  // outside a modal dialog does not contain the dialog's fixed descendants.
  if (inTopLayer(el)) return null;
  const root = el.ownerDocument;
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node === root.body || node === root.documentElement) return null;
    const style = getComputedStyle(node);
    if (establishesContainingBlock(style)) return node;
    if (position === 'absolute' && style.position !== 'static') return node;
    if (inTopLayer(node)) return null;
  }
  return null;
}

/**
 * The part of the viewport the floating element can actually be seen in: the
 * (visual) viewport, narrowed to the padding box of every ancestor whose
 * `overflow` clips it. A panel rendered in place inside a scroll box is cut off
 * at the box's edge however much room the viewport has, so `flip`, `shift` and
 * `size` have to measure against that edge.
 *
 * An ancestor clips an out-of-flow element only from its containing block up:
 * `position: absolute` is not clipped by a scroll box that sits between it and
 * its positioned ancestor, the top layer by none at all, and `fixed` by none
 * below the nearest transformed (filtered, contained…) ancestor — or below the
 * top-layer element it sits in. The walk therefore jumps from every out-of-flow
 * box straight to its containing block.
 * `body` and `html` are not consulted — the viewport stands for them, and a
 * scroll lock's `overflow: hidden` on either hides nothing that is on screen.
 *
 * With no clipping ancestor this is the viewport rectangle itself, the boundary
 * every overlay measured against before.
 */
export function clippingBoundary(floating: HTMLElement): Boundary {
  const boundary: Boundary = {
    top: 0,
    left: 0,
    right: window.visualViewport?.width ?? window.innerWidth,
    bottom: window.visualViewport?.height ?? window.innerHeight
  };
  const first = floating.parentElement;
  if (!first) return boundary;

  const root = floating.ownerDocument;
  let escapeTo = containingBlockOf(floating, getComputedStyle(floating).position);
  for (let node: Element | null = first; node; node = node.parentElement) {
    if (node === root.body || node === root.documentElement) break;
    if (escapeTo !== undefined && node !== escapeTo) continue;

    const style = getComputedStyle(node);
    const clipsX = CLIPPING_OVERFLOW.test(style.overflowX);
    const clipsY = CLIPPING_OVERFLOW.test(style.overflowY);
    if ((clipsX || clipsY) && style.display !== 'inline' && style.display !== 'contents') {
      const box = node.getBoundingClientRect();
      const left = box.left + node.clientLeft;
      const top = box.top + node.clientTop;
      if (clipsX) {
        boundary.left = Math.max(boundary.left, left);
        boundary.right = Math.min(boundary.right, left + node.clientWidth);
      }
      if (clipsY) {
        boundary.top = Math.max(boundary.top, top);
        boundary.bottom = Math.min(boundary.bottom, top + node.clientHeight);
      }
    }
    escapeTo = containingBlockOf(node, style.position);
  }
  return boundary;
}

function detectOverflow(state: MiddlewareState, padding = 0) {
  const { boundary } = state;
  return {
    top: boundary.top + padding - state.y,
    bottom: state.y + state.rects.floating.height - boundary.bottom + padding,
    left: boundary.left + padding - state.x,
    right: state.x + state.rects.floating.width - boundary.right + padding
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
  let boundary = clippingBoundary(floating);
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
      strategy,
      boundary
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
      boundary = clippingBoundary(floating);
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
        const { boundary } = state;
        const room: Record<Side, number> = {
          top: ref.top - boundary.top,
          bottom: boundary.bottom - ref.bottom,
          left: ref.left - boundary.left,
          right: boundary.right - ref.right
        };
        const opposite = getOppositeSide(side);

        if (room[opposite] > room[side]) {
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

      // Room in the placement's MAIN axis is measured anchor → boundary edge:
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
