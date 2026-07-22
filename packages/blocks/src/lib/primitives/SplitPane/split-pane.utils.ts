// Pure geometry for the SplitPane primitive. Every function here is
// side-effect-free and DOM-free so the resize math can be unit-tested in the
// node environment (no jsdom) and the `.svelte` file can stay a thin shell over
// it — exactly the split Slider draws between its keyboard math and its markup.

/** Layout axis. `horizontal` = panes side by side; `vertical` = stacked. */
export type SplitPaneOrientation = 'horizontal' | 'vertical';

/**
 * A min/max boundary for the first pane. A raw `number` is pixels; a string
 * ending in `%` (e.g. `'20%'`) is a percentage of the container. A bare numeric
 * string (`'200'`) is also treated as pixels.
 */
export type SplitPaneLimit = number | string;

/** The four rect fields the pointer math reads — a structural subset of DOMRect. */
export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));

/**
 * Resolve a min/max limit to a ratio in `[0, 1]`.
 *
 * - Percentage strings (`'20%'`) convert directly and need no measurement.
 * - Pixel values (number or bare numeric string) are divided by `containerPx`.
 *
 * Returns `null` when a pixel limit cannot be resolved because the container has
 * not been measured yet (`containerPx <= 0`). Callers treat a `null` minimum as
 * `0` and a `null` maximum as `1`, so an unmeasured px limit degrades to "no
 * constraint" until the first layout pass, then clamps at runtime.
 */
export function parseLimit(limit: SplitPaneLimit, containerPx: number): number | null {
  if (typeof limit === 'string') {
    const trimmed = limit.trim();
    if (trimmed.endsWith('%')) {
      const pct = Number.parseFloat(trimmed.slice(0, -1));
      return Number.isFinite(pct) ? clamp01(pct / 100) : null;
    }
    const px = Number.parseFloat(trimmed);
    if (!Number.isFinite(px)) return null;
    return containerPx > 0 ? clamp01(px / containerPx) : null;
  }
  if (!Number.isFinite(limit)) return null;
  return containerPx > 0 ? clamp01(limit / containerPx) : null;
}

/**
 * Clamp a ratio into the `[min, max]` window, resolving px/percent limits
 * against `containerPx`. Unresolved px limits fall back to `0` (min) / `1`
 * (max). A reversed window (`min > max`) is tolerated by swapping the bounds so
 * the result is always well-defined. A non-finite input ratio snaps to the
 * lower bound.
 */
export function clampRatio(
  ratio: number,
  min: SplitPaneLimit,
  max: SplitPaneLimit,
  containerPx: number
): number {
  const lo = parseLimit(min, containerPx) ?? 0;
  const hi = parseLimit(max, containerPx) ?? 1;
  const low = Math.min(lo, hi);
  const high = Math.max(lo, hi);
  const r = Number.isFinite(ratio) ? ratio : low;
  return Math.min(high, Math.max(low, r));
}

/**
 * Convert a pointer coordinate to the first-pane ratio (`[0, 1]`), before
 * min/max clamping.
 *
 * - `horizontal`: uses `clientX` against `rect.left` / `rect.width`. When `rtl`
 *   is true the axis is mirrored (the first pane grows from the right edge).
 * - `vertical`: uses `clientY` against `rect.top` / `rect.height`; `rtl` has no
 *   effect on the vertical axis.
 *
 * A zero-sized container yields `0` rather than dividing by zero.
 */
export function ratioFromPointer(
  clientPos: number,
  rect: RectLike,
  orientation: SplitPaneOrientation,
  rtl = false
): number {
  if (orientation === 'vertical') {
    if (!(rect.height > 0)) return 0;
    return clamp01((clientPos - rect.top) / rect.height);
  }
  if (!(rect.width > 0)) return 0;
  const raw = (clientPos - rect.left) / rect.width;
  return clamp01(rtl ? 1 - raw : raw);
}

/** Limits + collapse config consumed by {@link resolveDragRatio}. */
export interface DragResolveOptions {
  min: SplitPaneLimit;
  max: SplitPaneLimit;
  collapsible: boolean;
  collapseThreshold: number;
}

/**
 * Dead-band added on top of `collapseThreshold` before a collapsed pane
 * re-expands during a drag. Without it, pointer jitter around the threshold
 * flip-flops ratio between `0` and `min` and bursts the change callbacks.
 */
export const COLLAPSE_HYSTERESIS_PX = 12;

/**
 * Decide the resting ratio and collapsed flag for a raw pointer ratio.
 *
 * Collapse wins over the min clamp: while `collapsible`, dragging the first pane
 * below `collapseThreshold` px snaps it fully shut (`ratio: 0`, `collapsed:
 * true`). While `currentlyCollapsed`, re-expanding requires clearing the
 * threshold plus {@link COLLAPSE_HYSTERESIS_PX} (drag hysteresis). Otherwise the
 * ratio is clamped into the `[min, max]` window and `collapsed` is `false`.
 */
export function resolveDragRatio(
  raw: number,
  containerPx: number,
  { min, max, collapsible, collapseThreshold }: DragResolveOptions,
  currentlyCollapsed = false
): { ratio: number; collapsed: boolean } {
  if (collapsible && containerPx > 0) {
    const releasePx = currentlyCollapsed
      ? collapseThreshold + COLLAPSE_HYSTERESIS_PX
      : collapseThreshold;
    if (raw * containerPx < releasePx) return { ratio: 0, collapsed: true };
  }
  return { ratio: clampRatio(raw, min, max, containerPx), collapsed: false };
}
