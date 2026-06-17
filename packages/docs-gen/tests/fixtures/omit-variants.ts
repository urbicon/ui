/**
 * Component whose Props type extends `Omit<XVariants, '...' | '...'>`
 * where XVariants is a `type` alias (over VariantProps<typeof xVariants>),
 * not an interface. This is the actual Card.tsx pattern that broke the
 * old findInterface lookup. Used to verify that PropsExtractor emits
 * the omit markers so APIDataGenerator can suppress the named variant
 * keys from the public API.
 *
 * The detection logic is name-suffix based (`isVariantInterface`) so it
 * works regardless of whether OmitFixtureVariants is declared as type
 * alias or interface — but the fixture mirrors the real-world type-alias
 * shape so a future refactor that re-introduces findInterface-lookup
 * would still fail this test.
 */

// Stand-in for `tv(...)` so the type alias has a concrete shape.
type VariantProps<T> = {
  [K in keyof T]?: keyof T[K];
};

declare const omitFixtureVariants: {
  variant: { a: unknown; b: unknown };
  size: { sm: unknown; md: unknown };
  secretInternal: { true: unknown; false: unknown };
};

export type OmitFixtureVariants = VariantProps<typeof omitFixtureVariants>;

/**
 * @description Omit-pattern test fixture.
 */
export interface OmitFixtureProps extends Omit<OmitFixtureVariants, 'secretInternal'> {
  /** Click handler. */
  onclick?: (event: MouseEvent) => void;
}
