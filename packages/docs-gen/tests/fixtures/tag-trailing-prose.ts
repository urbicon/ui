/**
 * A *Props declaration whose JSDoc puts prose AFTER the tag block — the shape
 * that shipped `"Toast\n\nBadge props are a discriminated union…"` as a related
 * component name.
 */

/**
 * @summary A fixture with prose after its tags.
 * @description Component used by the trailing-prose test.
 *
 * @tag feedback
 * @related Alert
 * @related Toast
 *
 * These props are a discriminated union. This paragraph sits after the tag
 * block, so TypeScript attaches it to the last tag's comment.
 */
export interface TrailingProseProps {
  /** Some label. */
  label?: string;
}

/**
 * @summary A fixture whose prose sits where it belongs.
 * @description Component used by the trailing-prose test.
 *
 * The same paragraph, but above the tags.
 *
 * @tag feedback
 * @related Alert
 * @related Toast
 */
export interface CleanTagsProps {
  /** Some label. */
  label?: string;
}

/**
 * The same trap with the tag-tag in last position — the prose attaches to
 * whichever tag closes the block, so both extractors need the same cut.
 * (Written without the literal tag name in prose: TypeScript parses an `@`
 * word anywhere in a JSDoc block as a tag, backticks included.)
 *
 * @summary A fixture whose last tag is the tag-tag.
 * @description Component used by the trailing-prose test.
 *
 * @related Alert
 * @tag feedback
 *
 * A paragraph after the tag block.
 */
export interface TrailingProseTagLastProps {
  /** Some label. */
  label?: string;
}
