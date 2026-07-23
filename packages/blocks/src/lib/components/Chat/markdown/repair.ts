/**
 * Streaming tail repair — the "remend" step for the incremental markdown engine.
 *
 * The incremental parser calls {@link repairMarkdownTail} on the *unsettled tail*
 * of the stream before parsing it, so half-arrived syntax renders as its settled
 * form instead of flickering (a dangling `**bold` shows as bold immediately, not
 * as two literal asterisks that vanish on the next chunk).
 *
 * Hard invariant: on text that already ends in complete syntax the function is an
 * exact no-op (returns the input unchanged). That is what keeps the streamed end
 * state identical to a one-shot parse of the full source. The function is also
 * idempotent — `repairMarkdownTail(repairMarkdownTail(x)) === repairMarkdownTail(x)`.
 *
 * Scope: this operates on the CommonMark/GFM subset the engine renders. Raw HTML
 * is plain text here (no tag balancing), and `$$` math is ordinary text — neither
 * is repaired. Open fenced code blocks are left entirely untouched so the block
 * parser can keep rendering them as an open code block.
 */

// ── Character classes ────────────────────────────────────────────────────────

function isWs(ch: string | undefined): boolean {
  // Undefined = start/end of string, which flanking rules treat as whitespace.
  return (
    ch === undefined ||
    ch === ' ' ||
    ch === '\t' ||
    ch === '\n' ||
    ch === '\r' ||
    ch === '\f' ||
    ch === '\v'
  );
}

/** ASCII punctuation (the CommonMark flanking set; sufficient for this subset). */
function isPunct(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  const c = ch.charCodeAt(0);
  return (
    (c >= 0x21 && c <= 0x2f) ||
    (c >= 0x3a && c <= 0x40) ||
    (c >= 0x5b && c <= 0x60) ||
    (c >= 0x7b && c <= 0x7e)
  );
}

function runLength(s: string, i: number, ch: string): number {
  let n = 0;
  while (s[i + n] === ch) n++;
  return n;
}

// ── Fenced code blocks ───────────────────────────────────────────────────────

const FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/**
 * Whether the text ends inside an open fenced code block. When it does, the tail
 * is left verbatim: no marker repair inside the fence, and the fence is not
 * closed (the block parser renders it as an open code block until the closing
 * fence streams in).
 */
function endsInsideOpenFence(text: string): boolean {
  const lines = text.split('\n');
  let open: { char: string; len: number } | null = null;
  for (const line of lines) {
    if (open === null) {
      const m = FENCE_OPEN.exec(line);
      if (m) open = { char: m[1][0], len: m[1].length };
    } else {
      const m = FENCE_CLOSE.exec(line);
      if (m && m[1][0] === open.char && m[1].length >= open.len) open = null;
    }
  }
  return open !== null;
}

// ── Inline code spans ────────────────────────────────────────────────────────

/** Index of the next backtick run of *exactly* `len` (a code-span closer), or -1. */
function findClosingBacktick(s: string, from: number, len: number): number {
  let i = from;
  while (i < s.length) {
    if (s[i] === '`') {
      const run = runLength(s, i, '`');
      if (run === len) return i;
      i += run;
    } else {
      i++;
    }
  }
  return -1;
}

// ── Link / image detection ───────────────────────────────────────────────────

/** Match the `(` at `open` against its closing `)`, honouring nested parens. */
function findMatchingParen(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '(') depth++;
    else if (c === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Match the `[` at `open` against its closing `]`, honouring nested brackets. */
function findClosingBracket(s: string, open: number): number {
  let depth = 0;
  for (let i = open; i < s.length; i++) {
    const c = s[i];
    if (c === '\\') {
      i++;
      continue;
    }
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

interface Dangling {
  /** Index of the opening `[`. */
  bracket: number;
  isImage: boolean;
  /** Where removal starts — the `!` for images, the `[` otherwise. */
  markStart: number;
}

function makeDangling(s: string, bracket: number): Dangling | null {
  // A blank line inside the candidate means it is settled literal text (a link
  // label cannot span a paragraph break), not a half-streamed link.
  if (s.indexOf('\n\n', bracket) !== -1) return null;
  const isImage =
    bracket >= 1 && s[bracket - 1] === '!' && !(bracket >= 2 && s[bracket - 2] === '\\');
  return { bracket, isImage, markStart: isImage ? bracket - 1 : bracket };
}

/**
 * Find an incomplete link/image whose syntax runs to the end of the text. A
 * construct is complete once its `](url)` or `][ref]` (or a bare closed `[...]`)
 * has arrived; anything short of that is dangling.
 */
function findDanglingConstruct(s: string): Dangling | null {
  let i = 0;
  let lastOpen = -1;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (c === '`') {
      const run = runLength(s, i, '`');
      const close = findClosingBacktick(s, i + run, run);
      if (close === -1) break; // open code span owns the rest of the string
      i = close + run;
      continue;
    }
    if (c === '[') {
      lastOpen = i;
      i++;
      continue;
    }
    if (c === ']' && lastOpen !== -1) {
      const j = i + 1;
      const next = s[j];
      if (next === '(') {
        const cp = findMatchingParen(s, j);
        if (cp === -1) return makeDangling(s, lastOpen); // `[label](url…`
        i = cp + 1;
        lastOpen = -1;
        continue;
      }
      if (next === '[') {
        const cb = findClosingBracket(s, j);
        if (cb === -1) return makeDangling(s, lastOpen); // `[label][ref…`
        i = cb + 1;
        lastOpen = -1;
        continue;
      }
      // Closed bracket with no link/ref continuation → complete/plain `[...]`.
      lastOpen = -1;
      i = j;
      continue;
    }
    i++;
  }
  return lastOpen === -1 ? null : makeDangling(s, lastOpen);
}

function extractLabel(s: string, bracket: number): string {
  const close = findClosingBracket(s, bracket);
  return close === -1 ? s.slice(bracket + 1) : s.slice(bracket + 1, close);
}

/**
 * Strip a trailing incomplete link/image. Links keep their label text (which is
 * then marker-repaired downstream); images are removed whole, since a broken
 * image placeholder is worse than nothing.
 */
function stripDanglingLinkOrImage(text: string): string {
  const found = findDanglingConstruct(text);
  if (found === null) return text;
  if (found.isImage) return text.slice(0, found.markStart);
  return text.slice(0, found.bracket) + extractLabel(text, found.bracket);
}

// ── Emphasis / strike / inline-code marker balancing ─────────────────────────

interface Delim {
  char: '*' | '_' | '~';
  len: number;
  canOpen: boolean;
  canClose: boolean;
}

interface OpenMarker {
  char: '*' | '_' | '~';
  remaining: number;
}

function flanking(
  char: '*' | '_' | '~',
  before: string | undefined,
  after: string | undefined
): { canOpen: boolean; canClose: boolean } {
  const leftFlanking = !isWs(after) && (!isPunct(after) || isWs(before) || isPunct(before));
  const rightFlanking = !isWs(before) && (!isPunct(before) || isWs(after) || isPunct(after));
  if (char === '_') {
    // Underscore cannot open/close intra-word (so `snake_case` stays literal).
    return {
      canOpen: leftFlanking && (!rightFlanking || isPunct(before)),
      canClose: rightFlanking && (!leftFlanking || isPunct(after))
    };
  }
  return { canOpen: leftFlanking, canClose: rightFlanking };
}

/**
 * Tokenize inline markers, skipping escapes and closed code spans. `openCode` is
 * the length of a trailing unclosed backtick run (0 if none); when set, scanning
 * stops there — everything after an unclosed run is code, not markup.
 */
function scanInline(s: string): { tokens: Delim[]; openCode: number } {
  const tokens: Delim[] = [];
  let openCode = 0;
  let i = 0;
  const n = s.length;
  while (i < n) {
    const c = s[i];
    if (c === '\\') {
      i += 2; // escaped char is literal — the marker after `\` does not count
      continue;
    }
    if (c === '`') {
      const run = runLength(s, i, '`');
      const close = findClosingBacktick(s, i + run, run);
      if (close === -1) {
        // Only close a backtick that plausibly opens a still-streaming span:
        // its content is non-empty and on the same line (a lone trailing
        // backtick, or one with a full prose line after it, is literal in
        // CommonMark — closing it would break the no-op invariant). Content
        // ending in a backtick is skipped too, so the appended closer cannot
        // merge into the run and defeat idempotency.
        const content = s.slice(i + run);
        if (content.length > 0 && !content.includes('\n') && content[content.length - 1] !== '`') {
          openCode = run;
        }
        break;
      }
      i = close + run;
      continue;
    }
    if (c === '*' || c === '_' || c === '~') {
      const run = runLength(s, i, c);
      // A lone `~` is not a marker — only `~~` is strikethrough.
      if (c === '~' && run < 2) {
        i += run;
        continue;
      }
      const { canOpen, canClose } = flanking(c, s[i - 1], s[i + run]);
      // Normalize `~` runs to a single strike delimiter (length 2).
      tokens.push({ char: c, len: c === '~' ? 2 : run, canOpen, canClose });
      i += run;
      continue;
    }
    i++;
  }
  return { tokens, openCode };
}

/**
 * Reduce the delimiter run list to the openers still unmatched at the end
 * (bottom-of-stack first). Closers without a matching opener are left as literal
 * text; only genuinely open markers are reported.
 */
function resolveOpenMarkers(tokens: Delim[]): OpenMarker[] {
  const stack: OpenMarker[] = [];
  for (const tok of tokens) {
    let remaining = tok.len;
    if (tok.canClose) {
      while (remaining > 0) {
        let idx = -1;
        for (let k = stack.length - 1; k >= 0; k--) {
          if (stack[k].char === tok.char) {
            idx = k;
            break;
          }
        }
        if (idx === -1) break;
        // Openers stacked above the match cannot pair with this closer.
        stack.length = idx + 1;
        const opener = stack[idx];
        let use = tok.char === '~' ? 2 : opener.remaining >= 2 && remaining >= 2 ? 2 : 1;
        use = Math.min(use, opener.remaining, remaining);
        opener.remaining -= use;
        remaining -= use;
        if (opener.remaining === 0) stack.pop();
      }
    }
    if (tok.canOpen && remaining > 0) stack.push({ char: tok.char, remaining });
  }
  return stack;
}

// ── Public API ───────────────────────────────────────────────────────────────

function repairInline(text: string): string {
  const stripped = stripDanglingLinkOrImage(text);
  const { tokens, openCode } = scanInline(stripped);
  const openMarkers = resolveOpenMarkers(tokens);
  if (openCode === 0 && openMarkers.length === 0) return stripped;
  let out = stripped;
  // Innermost first: an open code span sits inside any open emphasis, and the
  // emphasis stack is innermost-at-top.
  if (openCode > 0) out += '`'.repeat(openCode);
  for (let k = openMarkers.length - 1; k >= 0; k--) {
    out += openMarkers[k].char.repeat(openMarkers[k].remaining);
  }
  return out;
}

/**
 * Repair the unsettled tail of a streamed markdown source: close unpaired inline
 * markers and drop half-arrived links/images. A no-op on complete syntax.
 */
export function repairMarkdownTail(text: string): string {
  if (text.length === 0) return text;
  // Inside an open fence, everything is code — leave it exactly as-is.
  if (endsInsideOpenFence(text)) return text;
  return repairInline(text);
}
