/**
 * Props interface for InlineCode component
 *
 * @summary Renders a plain string, turning its backtick-wrapped spans into code.
 * @description The documentation surfaces carry strings that were written for a
 * markdown reader: prop descriptions come from JSDoc, where naming a field in
 * backticks is the convention, and 78% of them do it. Rendered as text those
 * backticks reach the reader as characters.
 *
 * This turns paired backticks into `<code>` and leaves everything else alone. It
 * is not a markdown renderer — no emphasis, no links — and it never uses
 * `{@html}`, so a string is escaped whatever it contains.
 *
 * @tag display
 * @tag documentation
 * @related CodeExample
 * @related ApiReference
 *
 * @example
 * ```svelte
 * <InlineCode text="Set `defaults` to the table's own props." />
 * ```
 */
export interface InlineCodeProps {
  /**
   * The string to render. Paired backticks become `<code>`; an unpaired one is
   * left as a character.
   */
  text?: string;

  /**
   * Classes for the generated `<code>` elements. The default follows body copy;
   * a table cell or a caption can pass its own scale.
   */
  codeClass?: string;
}

export { default as InlineCode } from './InlineCode.svelte';
