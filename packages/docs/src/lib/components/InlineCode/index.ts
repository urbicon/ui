/**
 * Props interface for InlineCode component
 *
 * @summary Renders a plain string, turning its markdown code and emphasis spans into elements.
 * @description The documentation surfaces carry strings that were written for a
 * markdown reader: prop descriptions come from JSDoc, where naming a field in
 * backticks is the convention and `**strong**` / `*emphasis*` mark the word a
 * contract turns on. Rendered as text those markers reach the reader as
 * characters.
 *
 * This renders exactly that inline subset — paired backticks as `<code>`,
 * `**…**` as `<strong>`, `*…*` as `<em>` — and leaves everything else as
 * written: links, underscores, any marker without a partner and any run of three
 * or more asterisks. It never uses `{@html}`, so a string is escaped whatever it
 * contains.
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
   * The string to render. Paired backticks become `<code>`, `**…**` `<strong>`
   * and `*…*` `<em>`; a marker without a partner, or a run of three or more
   * asterisks, is left as written.
   */
  text?: string;

  /**
   * Classes for the generated `<code>` elements. The default follows body copy;
   * a table cell or a caption can pass its own scale.
   */
  codeClass?: string;
}

export { default as InlineCode } from './InlineCode.svelte';
