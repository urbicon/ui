/**
 * Fixture for `@see` on *type declarations* (not prop members). Mirrors
 * `see-tags.ts`, which covers the prop side.
 */

/**
 * A datum with a bare sibling-type reference — prose, not a link target.
 *
 * @see CartesianDatum
 */
export interface BarChartDatum {
  /** Category label. */
  label: string;
  /** Numeric value. */
  value: number;
}

/**
 * A type alias pointing at real documentation.
 *
 * @see https://example.com/spec
 */
export type ChartScale = 'linear' | 'log';

/**
 * Both roles at once: a navigable route plus two prose references.
 *
 * @see /blocks/components/bar-chart#api
 * @see CartesianDatum
 * @see ChartScale
 */
export type ChartConfig = {
  scale: ChartScale;
};

/** No `@see` at all — must stay undefined rather than an empty array. */
export interface PlainDatum {
  value: number;
}
