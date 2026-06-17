/**
 * Dependency-free chart math, palette, and formatting helpers shared across
 * the charts/ family. Pure functions only — unit-tested in chart.utils.test.ts.
 *
 * Following the repo's zero-dependency philosophy (see Sankey's embedded
 * layout and the custom tv() engine), charts hand-roll their scales rather
 * than pulling in d3.
 */

/** A point in plot-local SVG coordinates. */
export type ChartPoint = [x: number, y: number];

/** Inclusive `[min, max]` of a numeric array; `[0, 0]` for an empty array. */
export function extent(values: readonly number[]): [number, number] {
  if (values.length === 0) return [0, 0];
  let min = values[0];
  let max = values[0];
  for (let i = 1; i < values.length; i++) {
    const v = values[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}

/**
 * Linear mapping from a numeric `domain` onto a pixel `range`. A zero-width
 * domain collapses to the range start (avoids divide-by-zero → NaN coords).
 */
export function linearScale(
  domain: [number, number],
  range: [number, number]
): (value: number) => number {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;
  if (span === 0) return () => r0;
  return (value) => r0 + ((value - d0) / span) * (r1 - r0);
}

/** Categorical band scale over `count` items across a pixel `range`. */
export interface BandScale {
  /** Left edge of band `index`. */
  position(index: number): number;
  /** Center of band `index` (use for line/scatter x). */
  center(index: number): number;
  /** Rendered width of a single band (step minus padding). */
  bandwidth: number;
  /** Distance between consecutive band starts. */
  step: number;
}

/**
 * Evenly spaced categorical bands with inner padding. `padding` is the
 * fraction (0–1) of each step left empty around bands.
 */
export function bandScale(count: number, range: [number, number], padding = 0.2): BandScale {
  const [r0, r1] = range;
  const span = r1 - r0;
  const step = count > 0 ? span / count : 0;
  const bandwidth = Math.max(0, step * (1 - padding));
  const offset = (step - bandwidth) / 2;
  return {
    step,
    bandwidth,
    position: (index) => r0 + index * step + offset,
    center: (index) => r0 + index * step + step / 2
  };
}

/** Round `value` to a "nice" number (1·10ⁿ, 2·10ⁿ, 5·10ⁿ). */
function niceNum(value: number, round: boolean): number {
  const exponent = Math.floor(Math.log10(value));
  const fraction = value / 10 ** exponent;
  let niceFraction: number;
  if (round) {
    if (fraction < 1.5) niceFraction = 1;
    else if (fraction < 3) niceFraction = 2;
    else if (fraction < 7) niceFraction = 5;
    else niceFraction = 10;
  } else {
    if (fraction <= 1) niceFraction = 1;
    else if (fraction <= 2) niceFraction = 2;
    else if (fraction <= 5) niceFraction = 5;
    else niceFraction = 10;
  }
  return niceFraction * 10 ** exponent;
}

/**
 * Round a raw `[min, max]` outward to "nice" round bounds suitable for an
 * axis and return evenly spaced tick values within them (Heckbert's
 * algorithm). With `includeZero` (default) the domain always reaches zero
 * for single-signed data so bars sit on a real baseline.
 */
export function niceScale(
  rawMin: number,
  rawMax: number,
  tickCount = 5,
  includeZero = true
): { min: number; max: number; ticks: number[] } {
  let lo = rawMin;
  let hi = rawMax;
  if (includeZero) {
    if (lo > 0) lo = 0;
    if (hi < 0) hi = 0;
  }
  // Degenerate range (all-equal / all-zero data): open a unit window so the
  // axis still renders sensible ticks.
  if (lo === hi) hi = lo + 1;

  const range = niceNum(hi - lo, false);
  const spacing = niceNum(range / Math.max(1, tickCount - 1), true);
  const niceMin = Math.floor(lo / spacing) * spacing;
  const niceMax = Math.ceil(hi / spacing) * spacing;

  // Decimal precision implied by the spacing (e.g. 0.2 → 1 place). Rounding
  // each tick to it strips FP noise like 0.6000000000000001; index-based
  // generation avoids error accumulation.
  const decimals = Math.max(0, -Math.floor(Math.log10(spacing)));
  const round = (n: number) => Number(n.toFixed(decimals));
  const count = Math.min(1000, Math.max(0, Math.round((niceMax - niceMin) / spacing)));

  const ticks: number[] = [];
  for (let i = 0; i <= count; i++) {
    ticks.push(round(niceMin + i * spacing));
  }
  return { min: round(niceMin), max: round(niceMax), ticks };
}

/** Trim a coordinate to 2 decimals — compact, deterministic SVG paths. */
function coord(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** SVG path `d` for a polyline through `points` (straight segments). */
export function linePath(points: readonly ChartPoint[]): string {
  if (points.length === 0) return '';
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${coord(x)},${coord(y)}`).join('');
}

/** SVG path `d` for a filled area between `points` and a horizontal `baselineY`. */
export function areaPath(points: readonly ChartPoint[], baselineY: number): string {
  if (points.length === 0) return '';
  const top = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${coord(x)},${coord(y)}`).join('');
  const first = points[0];
  const last = points[points.length - 1];
  return `${top}L${coord(last[0])},${coord(baselineY)}L${coord(first[0])},${coord(baselineY)}Z`;
}

const TAU = Math.PI * 2;

/** Polar → cartesian. `angle` in radians, 0 at 12 o'clock, increasing clockwise. */
function polar(cx: number, cy: number, r: number, angle: number): ChartPoint {
  return [cx + r * Math.sin(angle), cy - r * Math.cos(angle)];
}

/**
 * SVG path `d` for a donut/pie segment between `startAngle` and `endAngle`
 * (radians, clockwise from 12 o'clock). `innerRadius` of 0 yields a filled pie
 * slice. A full-circle sweep is split into two arcs so it renders as a ring
 * rather than collapsing to a point.
 */
export function arcPath(
  cx: number,
  cy: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
): string {
  const sweep = endAngle - startAngle;
  if (sweep >= TAU - 1e-6) {
    const mid = startAngle + Math.PI;
    return (
      arcPath(cx, cy, outerRadius, innerRadius, startAngle, mid) +
      arcPath(cx, cy, outerRadius, innerRadius, mid, endAngle - 1e-9)
    );
  }

  const largeArc = sweep > Math.PI ? 1 : 0;
  const [ox0, oy0] = polar(cx, cy, outerRadius, startAngle);
  const [ox1, oy1] = polar(cx, cy, outerRadius, endAngle);

  if (innerRadius <= 0) {
    return (
      `M${coord(cx)},${coord(cy)}L${coord(ox0)},${coord(oy0)}` +
      `A${coord(outerRadius)},${coord(outerRadius)} 0 ${largeArc} 1 ${coord(ox1)},${coord(oy1)}Z`
    );
  }

  const [ix1, iy1] = polar(cx, cy, innerRadius, endAngle);
  const [ix0, iy0] = polar(cx, cy, innerRadius, startAngle);
  return (
    `M${coord(ox0)},${coord(oy0)}` +
    `A${coord(outerRadius)},${coord(outerRadius)} 0 ${largeArc} 1 ${coord(ox1)},${coord(oy1)}` +
    `L${coord(ix1)},${coord(iy1)}` +
    `A${coord(innerRadius)},${coord(innerRadius)} 0 ${largeArc} 0 ${coord(ix0)},${coord(iy0)}Z`
  );
}

/**
 * Ordered categorical palette mapped to the `--color-chart-*` tokens
 * (declared in `style/semantic.css`). Cycles for series beyond its length.
 */
export const chartPalette: readonly string[] = [
  'var(--color-chart-1)',
  'var(--color-chart-2)',
  'var(--color-chart-3)',
  'var(--color-chart-4)',
  'var(--color-chart-5)',
  'var(--color-chart-6)'
];

/** Resolve a series color: explicit override wins, else cycle the palette. */
export function seriesColor(
  index: number,
  explicit?: string,
  palette: readonly string[] = chartPalette
): string {
  if (explicit) return explicit;
  if (palette.length === 0) return 'currentColor';
  return palette[((index % palette.length) + palette.length) % palette.length];
}

/**
 * A locale-aware number formatter. Falls back to `String(value)` if `Intl`
 * is unavailable (defensive — present in every modern browser + SSR runtime).
 */
export function numberFormatter(
  locale?: string,
  options?: Intl.NumberFormatOptions
): (value: number) => string {
  try {
    const nf = new Intl.NumberFormat(locale, options);
    return (value) => nf.format(value);
  } catch {
    return (value) => String(value);
  }
}
