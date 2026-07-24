/**
 * Fixture for the see-tag split (link target vs. prose reference).
 *
 * The shapes below are exactly the ones TypeScript mis-parses into
 * `JSDocSeeTag.name` + a leftover `comment` — see `PropsExtractor.extractSeeValues`.
 *
 * Descriptions here deliberately avoid the literal tag spelling: TypeScript
 * parses it as a tag even mid-sentence, which would add phantom references.
 *
 * @description Fixture component for see-tag extraction
 */
export interface SeeTagsProps {
  /**
   * A prop referencing an absolute URL.
   * @see https://svelte.dev/docs/svelte/snippet
   */
  externalLink?: string;

  /**
   * A prop referencing a route-relative doc path.
   * @see /blocks/primitives/button#variants
   */
  routeLink?: string;

  /**
   * A prop referencing a bare in-page fragment.
   * @see #type-MintProp
   */
  fragmentLink?: string;

  /**
   * A prop referencing a bare type name.
   * @see CartesianDatum
   */
  bareType?: string;

  /**
   * A prop referencing a dotted member. TypeScript puts the whole value in
   * `JSDocSeeTag.name` and leaves no `comment` at all — the old extractor
   * dropped this tag silently.
   * @see HTMLButtonAttributes.value
   */
  dottedMember?: string;

  /**
   * A dotted member ending in a keyword — TypeScript ends the name reference at
   * `HTMLButtonAttributes.` and leaves `class` behind in `comment`.
   * @see HTMLButtonAttributes.class
   */
  keywordMember?: string;

  /**
   * A reference followed by another tag, whose leading comment asterisk leaks
   * into `JSDocSeeTag.comment` as a bare `*`.
   * @see HTMLButtonAttributes.disabled
   * @default false
   */
  followedByTag?: boolean;

  /**
   * Several references at once: one navigable target, two prose names.
   * @see Foo
   * @see https://example.com/docs
   * @see Bar.baz
   */
  multiple?: string;

  /**
   * An inline `{@link}` payload should reduce to the bare URL.
   * @see {@link https://example.com/linked Example}
   */
  jsdocLink?: string;

  /** A prop carrying no reference tag whatsoever. */
  plain?: string;
}
