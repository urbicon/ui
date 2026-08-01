/**
 * The one edit this add-on makes to consumer code: add the Urbicon UI token
 * sheet to the app stylesheet.
 *
 * Order matters — the blocks `style/index.css` must be imported AFTER Tailwind
 * so the semantic tokens override Tailwind's defaults. And it must be the single
 * `index.css` (never the foundation/semantic/interaction subfiles): the bundled
 * sheet carries the `@source` directives that make Tailwind generate the
 * components' classes, so the consumer needs no `@source` of their own.
 *
 * All scanning runs against a comment-masked copy of the content: a tailwind
 * import inside a block comment must not become the insertion anchor (the added
 * line would be commented out — unstyled components with no error), and a
 * commented-out or merely *mentioned* blocks import must not trip the
 * idempotency guard and silently disable the add-on.
 *
 * Pure string → string, handed to `sv.file` as the edit callback — kept free of
 * workspace and filesystem concerns so it is trivially unit-testable.
 */

export const BLOCKS_IMPORT = "@import '@urbicon-ui/blocks/style/index.css';";

/** Blank out block-comment spans (newlines kept) so scans see only effective CSS. */
function maskComments(css: string): string {
  let out = '';
  let inComment = false;
  for (let i = 0; i < css.length; i++) {
    if (!inComment && css.startsWith('/*', i)) {
      inComment = true;
      out += '  ';
      i++;
    } else if (inComment && css.startsWith('*/', i)) {
      inComment = false;
      out += '  ';
      i++;
    } else {
      const ch = css[i] as string;
      out += inComment && ch !== '\n' ? ' ' : ch;
    }
  }
  return out;
}

/** Add the blocks token-sheet import to a stylesheet's content, idempotently. */
export function addBlocksImport(content: string): string {
  if (content.length === 0) return `${BLOCKS_IMPORT}\n`;
  const lines = content.split('\n');
  const masked = maskComments(content).split('\n');
  const line = (i: number): string => masked[i] ?? '';
  // Keep the file's own line endings: split('\n') leaves the '\r' on each
  // line, so the inserted one must carry it too or the file ends up mixed.
  const insert = content.includes('\r\n') ? `${BLOCKS_IMPORT}\r` : BLOCKS_IMPORT;

  // Idempotent — but only a REAL import line counts (see head comment).
  if (
    masked.some((l) => /^\s*@import\b/.test(l) && l.includes('@urbicon-ui/blocks/style/index.css'))
  ) {
    return content;
  }

  // Anchor: the LAST tailwind import (covers split `tailwindcss/…` layer
  // imports); else the last `@import` of any kind (CSS requires imports before
  // rules); else a leading `@charset` (which must stay first); else the top.
  let at = -1;
  for (const [i, l] of masked.entries()) {
    if (/^\s*@import\s+['"]tailwindcss/.test(l)) at = i;
  }
  if (at === -1) {
    for (const [i, l] of masked.entries()) {
      if (/^\s*@import\b/.test(l)) at = i;
    }
  }
  if (at !== -1) {
    // A wrapped import statement ends on the line carrying its `;` — inserting
    // before that would split the statement into invalid CSS.
    while (at < masked.length - 1 && !line(at).includes(';')) at++;
    lines.splice(at + 1, 0, insert);
    return lines.join('\n');
  }
  const first = masked.findIndex((l) => l.trim() !== '');
  if (first !== -1 && /^\s*@charset\b/.test(line(first))) {
    lines.splice(first + 1, 0, insert);
    return lines.join('\n');
  }
  return `${insert}\n${content}`;
}
