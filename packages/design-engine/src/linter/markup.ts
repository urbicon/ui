/**
 * A small, dependency-free markup scanner — the structural pass the regex rules
 * cannot be (DESIGN-MCP-V2 §6/§10 "AST pass"). It does NOT build a full Svelte
 * AST (that would mean a `svelte/compiler` dependency, and this engine is
 * zero-dep): it extracts the one thing the line-based rules miss — *which
 * attribute belongs to which element* — by walking the source once and emitting a
 * flat list of opening tags with their attributes, plus a helper to slice an
 * element's inner content.
 *
 * It is deliberately conservative: anything it cannot parse confidently (an
 * unterminated tag, an exotic expression) is skipped, never guessed. A rule built
 * on this therefore never fires on a mis-parse — a missed element is silence, not
 * a false positive, which is the contract the correctness gate depends on.
 */

import { maskHtmlComments, maskScriptAndStyle } from './mask.js';

/** How an attribute carries its value. */
export type AttrKind =
  | 'string' // attr="literal" / attr='literal' / attr=bare
  | 'expression' // attr={expr}
  | 'boolean' // bare attr, no value
  | 'shorthand' // {value} — name and expression are the same identifier
  | 'spread'; // {...rest}

export interface Attr {
  /** Attribute name, e.g. `variant`, `aria-label`, `on:click`. Empty for spread/shorthand. */
  name: string;
  /** Raw inner value (no quotes/braces); `null` for a boolean attribute. */
  value: string | null;
  kind: AttrKind;
  /** 1-based line of the attribute name. */
  line: number;
  /** Char offset of the attribute name (undefined for spread/shorthand, which have none). */
  nameStart?: number;
  /** Char offset where the raw inner value begins (inside quotes/braces). Undefined for boolean attrs. */
  valueStart?: number;
  /** Char offset just past the raw inner value (before the closing quote/brace). Undefined for boolean attrs. */
  valueEnd?: number;
}

export interface Element {
  /** Tag name as written, e.g. `Button`, `button`, `Foo.Bar`. */
  tag: string;
  /** PascalCase or dotted tag → a component (not a raw HTML element). */
  isComponent: boolean;
  attrs: Attr[];
  /** 1-based line of the opening `<`. */
  line: number;
  selfClosing: boolean;
  /** Char offset of the opening `<`. */
  openStart: number;
  /** Char offset just past the opening tag's `>`. */
  openEnd: number;
}

/**
 * Blank HTML comments and `<script>`/`<style>` blocks (keeping newlines so line
 * numbers hold) — their bodies are comments/JS/CSS, not markup, and would feed the
 * tag scanner garbage. Comments are blanked here too (not relying on an upstream
 * mask) so {@link scanMarkup} and {@link innerContent} are correct on raw input.
 *
 * Caveat: the `<script>` region ends at the first `</script>`, so such a literal
 * inside a JS string ends the blank early and the trailing JS is then scanned as
 * markup. This is narrower than the line-based rules (which don't blank scripts at
 * all); no real file hits it, and any mis-scan only ever yields a skipped tag,
 * never a wrong finding from the curated rules.
 *
 * Two deliberate differences from the older non-greedy regexes this replaced:
 * the opener requires a word boundary, so a `<ScriptEditor …>` component no longer
 * opens a script region and blanks the markup after it (it did, case-insensitively,
 * and every rule went quiet until the next `</script>`); and the closer allows
 * `</script >`, which HTML permits and which previously left the region open to
 * the end of the file.
 */
function blankNonMarkup(src: string): string {
  return maskScriptAndStyle(maskHtmlComments(src));
}

const isNameStart = (c: string | undefined): boolean => c !== undefined && /[A-Za-z]/.test(c);
const isTagNameChar = (c: string | undefined): boolean =>
  c !== undefined && /[A-Za-z0-9.\-:]/.test(c);
const isAttrNameChar = (c: string | undefined): boolean =>
  c !== undefined && !/[\s=/>]/.test(c) && c !== '<';

/** Read a quoted string starting at `src[i]` (a quote char). Returns inner value + index past the close. */
function readQuoted(src: string, i: number): { value: string; end: number } {
  const quote = src[i];
  let j = i + 1;
  while (j < src.length && src[j] !== quote) j++;
  return { value: src.slice(i + 1, j), end: j + 1 }; // j+1 steps past the closing quote (or EOF)
}

/**
 * Read a balanced `{…}` expression starting at `src[i]` (`{`). Brace depth counts
 * outside of `"`/`'` strings (so a `}` inside a string literal does not close it,
 * and a `\"` escape does not end the string early); `${…}` in template literals
 * balances naturally through the same counter. Returns the inner text + index past
 * the closing brace, or `end: -1` if never closed.
 */
export function readBraced(src: string, i: number): { value: string; end: number } {
  let depth = 0;
  let str: string | null = null; // active "/' string delimiter, if any
  for (let j = i; j < src.length; j++) {
    const c = src[j];
    if (str !== null) {
      if (c === '\\') {
        j++; // a backslash escapes the next char — don't let `\"` close the string early
        continue;
      }
      if (c === str) str = null;
      continue;
    }
    if (c === '"' || c === "'") str = c;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { value: src.slice(i + 1, j), end: j + 1 };
    }
  }
  return { value: '', end: -1 };
}

/** Parse one attribute starting at `src[i]` (first name/`{` char). Returns the attr + next index, or null if malformed. */
function parseAttr(src: string, i: number, line: number): { attr: Attr; end: number } | null {
  if (src[i] === '{') {
    const { value, end } = readBraced(src, i);
    if (end === -1) return null;
    const trimmed = value.trim();
    const spread = trimmed.startsWith('...');
    return {
      attr: {
        name: spread ? '' : trimmed,
        value: spread ? trimmed.slice(3).trim() : trimmed,
        kind: spread ? 'spread' : 'shorthand',
        line,
        valueStart: i + 1,
        valueEnd: end - 1
      },
      end
    };
  }

  let j = i;
  while (isAttrNameChar(src[j])) j++;
  const name = src.slice(i, j);
  if (name === '') return null; // not a valid attribute start — bail (caller skips the tag)

  // Optional `= value`, allowing whitespace around `=`.
  let k = j;
  while (k < src.length && /\s/.test(src[k] ?? '')) k++;
  if (src[k] !== '=') {
    return { attr: { name, value: null, kind: 'boolean', line, nameStart: i }, end: j };
  }
  k++; // past '='
  while (k < src.length && /\s/.test(src[k] ?? '')) k++;

  const c = src[k];
  if (c === '"' || c === "'") {
    const { value, end } = readQuoted(src, k);
    return {
      attr: {
        name,
        value,
        kind: 'string',
        line,
        nameStart: i,
        valueStart: k + 1,
        valueEnd: end - 1
      },
      end
    };
  }
  if (c === '{') {
    const { value, end } = readBraced(src, k);
    if (end === -1) return null;
    return {
      attr: {
        name,
        value,
        kind: 'expression',
        line,
        nameStart: i,
        valueStart: k + 1,
        valueEnd: end - 1
      },
      end
    };
  }
  // Bare unquoted value: read until whitespace or tag end.
  let m = k;
  while (m < src.length && !/[\s/>]/.test(src[m] ?? '')) m++;
  return {
    attr: {
      name,
      value: src.slice(k, m),
      kind: 'string',
      line,
      nameStart: i,
      valueStart: k,
      valueEnd: m
    },
    end: m
  };
}

/** Parse an opening tag starting at `src[start]` (`<`). Returns the element + index past `>`, or null. */
function parseOpenTag(
  src: string,
  start: number,
  line: number
): { element: Element; end: number } | null {
  let i = start + 1;
  while (isTagNameChar(src[i])) i++;
  const tag = src.slice(start + 1, i);
  if (tag === '') return null;

  const attrs: Attr[] = [];
  let curLine = line;
  // Count newlines as we advance so each attr/tag gets the right line.
  const bump = (from: number, to: number): void => {
    for (let p = from; p < to; p++) if (src[p] === '\n') curLine++;
  };

  let selfClosing = false;
  let closed = false;
  while (i < src.length) {
    const before = i;
    while (i < src.length && /\s/.test(src[i] ?? '')) i++;
    bump(before, i);

    const c = src[i];
    if (c === undefined) break; // EOF reached — `closed` stays false, rejected below
    if (c === '>') {
      i++;
      closed = true;
      break;
    }
    if (c === '/' && src[i + 1] === '>') {
      selfClosing = true;
      i += 2;
      closed = true;
      break;
    }
    const parsed = parseAttr(src, i, curLine);
    if (!parsed) return null; // unparseable attribute — skip the whole tag conservatively
    attrs.push(parsed.attr);
    bump(i, parsed.end);
    i = parsed.end;
  }
  if (!closed) return null; // ran off the end without a `>`/`/>` — malformed, skip

  const isComponent = /^[A-Z]/.test(tag) || tag.includes('.');
  return {
    element: { tag, isComponent, attrs, line, selfClosing, openStart: start, openEnd: i },
    end: i
  };
}

/** Scan source for opening element/component tags with their attributes. */
export function scanMarkup(source: string): Element[] {
  const src = blankNonMarkup(source);
  const elements: Element[] = [];
  let line = 1;
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\n') {
      line++;
      i++;
      continue;
    }
    // A tag opens at `<` immediately followed by a letter (not `</`, `<!`, `< `).
    if (c === '<' && isNameStart(src[i + 1])) {
      const parsed = parseOpenTag(src, i, line);
      if (parsed) {
        elements.push(parsed.element);
        for (let p = i; p < parsed.end; p++) if (src[p] === '\n') line++;
        i = parsed.end;
        continue;
      }
    }
    i++;
  }
  return elements;
}

/** Does `src` have `<tag`/`</tag` at `pos` with a real tag boundary after the name? */
function tagAt(src: string, pos: number, tag: string, closing: boolean): boolean {
  const lead = closing ? `</${tag}` : `<${tag}`;
  if (!src.startsWith(lead, pos)) return false;
  const after = src[pos + lead.length];
  return after === undefined || /[\s/>]/.test(after);
}

/**
 * The raw inner content of an element (between its opening `>` and matching
 * `</tag>`), honouring same-name nesting. Returns `null` for a self-closing
 * element or when no balanced close is found — callers treat `null` as "unknown",
 * and skip, so an unbalanced document never produces a false finding.
 */
export function innerContent(source: string, el: Element): string | null {
  if (el.selfClosing) return null;
  const src = blankNonMarkup(source);
  let depth = 1;
  let i = el.openEnd;
  while (i < src.length) {
    if (src[i] === '<') {
      if (tagAt(src, i, el.tag, true)) {
        depth--;
        if (depth === 0) return src.slice(el.openEnd, i);
      } else if (tagAt(src, i, el.tag, false)) {
        depth++;
      }
    }
    i++;
  }
  return null;
}
