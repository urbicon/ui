/**
 * mask.ts — blank out regions without moving anything.
 *
 * Every reader in the linter needs the same trick: hide a stretch of input
 * (a comment, a `<script>` body) from a scanner that would otherwise misread it,
 * while keeping every following character at the offset it already had. Blanking
 * to spaces and keeping the newlines does that — line and column numbers in a
 * finding still point at the line the author wrote.
 *
 * The obvious spelling is a non-greedy regex (`/<!--[\s\S]*?-->/g`), and it is
 * quadratic on input that opens a region it never closes: the engine scans to the
 * end of the file, fails, and starts over at the next opener — so N unclosed
 * `<!--` cost N passes over the tail. This linter reads model-generated markup
 * (`urbicon validate`, and the same engine behind `validate_design`), where a
 * stray `<!--` is an ordinary accident rather than an attack, so the slow input
 * is one that actually turns up.
 *
 * Scanning by index gives the identical result in a single left-to-right pass.
 * "Identical" is meant literally, and holds for the scan: an opener whose closer is
 * missing ends it and leaves the remainder untouched, which is exactly what the
 * non-greedy regex did — it simply found no match at all. (Verified by differential
 * test against the old expressions, 0 divergences in 837k inputs, including an
 * exhaustive sweep of every string up to length 6 over `<!->/*a`.)
 *
 * What is *not* identical is where a `<script>` region begins and ends — see
 * {@link scriptLike}. That is a separate, deliberate change of the delimiters.
 */

/** Blank every character except newlines: same length, same line breaks. */
export const blankRegion = (s: string): string => s.replace(/[^\n]/g, ' ');

/**
 * An open/close delimiter pair. Both carry `g` because the scan drives them by
 * `lastIndex`; that index is always set before use, so the shared module-level
 * state below never leaks between calls.
 */
interface Delimiters {
  readonly open: RegExp;
  readonly close: RegExp;
}

/**
 * How an HTML comment ends: `--!>` closes one too (HTML's "comment end bang"
 * state), so the mask honours it. Exported as a pattern *source* because the mask
 * is not the only reader that has to agree on where a comment stops — `suppress.ts`
 * reads `urbicon-ignore` pragmas out of the raw, unmasked source and would
 * otherwise scan straight past a closer the mask has already blanked. Sharing the
 * source string is what keeps the two from drifting apart in silence.
 */
export const HTML_COMMENT_END = '--!?>';

const HTML_COMMENT: Delimiters = { open: /<!--/g, close: new RegExp(HTML_COMMENT_END, 'g') };
const BLOCK_COMMENT: Delimiters = { open: /\/\*/g, close: /\*\//g };

/**
 * `\b` so a `<scripted>` component is not read as a script block. The closer takes
 * what an HTML parser takes: once `</script` is followed by whitespace, everything
 * up to the next `>` is attribute junk the parser discards — `</script >` and
 * `</script foo>` both end the block, `</scriptx>` does not. Case-insensitive:
 * unlike Svelte's own parser this is a "what should the scanner not look at" mask,
 * and `<SCRIPT>` is markup nobody should be scanning either way.
 *
 * `(?:\s[^>]*)?` and not `\s*[^>]*`: the single `\s` cannot share characters with
 * the run after it, so there is nothing for a backtracking engine to redistribute.
 */
const scriptLike = (tag: string): Delimiters => ({
  open: new RegExp(`<${tag}\\b`, 'gi'),
  close: new RegExp(`</${tag}(?:\\s[^>]*)?>`, 'gi')
});

const SCRIPT_BLOCK = scriptLike('script');
const STYLE_BLOCK = scriptLike('style');

/**
 * Blank each `open … close` region, left to right, in one pass.
 *
 * An unclosed opener stops the scan: the rest of the input is returned as-is,
 * matching the non-greedy regex this replaces.
 */
function maskRegions(src: string, { open, close }: Delimiters): string {
  let out = '';
  let cursor = 0;

  for (;;) {
    open.lastIndex = cursor;
    const opener = open.exec(src);
    if (!opener) break;

    close.lastIndex = opener.index + opener[0].length;
    const closer = close.exec(src);
    if (!closer) break;

    const end = closer.index + closer[0].length;
    out += src.slice(cursor, opener.index) + blankRegion(src.slice(opener.index, end));
    cursor = end;
  }

  return cursor === 0 ? src : out + src.slice(cursor);
}

/** Blank `<!-- … -->` comments. */
export const maskHtmlComments = (src: string): string => maskRegions(src, HTML_COMMENT);

/** Blank `/* … *\/` comments. Line comments are left alone — see {@link maskComments}. */
export const maskBlockComments = (src: string): string => maskRegions(src, BLOCK_COMMENT);

/** Blank `<script …> … </script>` and `<style …> … </style>` subtrees, bodies and tags alike. */
export const maskScriptAndStyle = (src: string): string =>
  maskRegions(maskRegions(src, SCRIPT_BLOCK), STYLE_BLOCK);
