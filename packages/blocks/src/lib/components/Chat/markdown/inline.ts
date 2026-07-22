import type { InlineNode, MarkdownParseOptions } from './types';
import { checkImageUrl, checkLinkUrl } from './url-policy';

/**
 * Inline parser for the streaming-markdown subset: code spans, links/images
 * (inline + reference + shortcut), citations, emphasis (`*`/`_`), strong,
 * strikethrough (`~~`), hard breaks, optional autolinks. Raw HTML is not a
 * concept here — angle brackets are plain text (decision A2).
 *
 * Two passes: tokenize into a flat list (code/link/image/citation/break/text
 * and emphasis delimiter runs), then match delimiter runs into a tree. The
 * delimiter rules are CommonMark-lite: `*` needs non-space on the inner side,
 * `_` additionally must not sit inside a word, `~~` only pairs as a double.
 */

export interface InlineContext {
  linkRefs: ReadonlyMap<string, { href: string; title?: string }>;
  options: MarkdownParseOptions;
  /**
   * Fired for `[label][ref]` / `[label]` candidates whose definition is not
   * (yet) known. The incremental parser uses this to know which settled
   * blocks must be invalidated when a late `[ref]: url` definition streams in.
   */
  onUnresolvedRef?: (label: string) => void;
}

// ── Tokenize ─────────────────────────────────────────────────────────────────

type DelimToken = {
  t: 'delim';
  marker: '*' | '_' | '~';
  length: number;
  canOpen: boolean;
  canClose: boolean;
};

type Token = { t: 'text'; text: string } | { t: 'node'; node: InlineNode } | DelimToken;

const PUNCT_BANG = '!';

function isWordChar(ch: string | undefined): boolean {
  if (ch === undefined) return false;
  return /[\p{L}\p{N}_]/u.test(ch);
}

function isSpaceLike(ch: string | undefined): boolean {
  return ch === undefined || /\s/.test(ch);
}

export function parseInlines(input: string, ctx: InlineContext): InlineNode[] {
  return matchDelimiters(tokenize(input, ctx, false));
}

function tokenize(input: string, ctx: InlineContext, insideLink: boolean): Token[] {
  const tokens: Token[] = [];
  let text = '';
  const flush = () => {
    if (text.length > 0) {
      tokens.push({ t: 'text', text });
      text = '';
    }
  };

  let i = 0;
  while (i < input.length) {
    const ch = input[i];

    // Backslash escapes — the escaped char becomes literal text.
    if (ch === '\\' && i + 1 < input.length) {
      const next = input[i + 1];
      if (next === '\n') {
        flush();
        tokens.push({ t: 'node', node: { kind: 'break' } });
      } else {
        text += next;
      }
      i += 2;
      continue;
    }

    // Hard break: two+ spaces before newline. Soft break renders as a space.
    if (ch === '\n') {
      const hard = /[ ]{2,}$/.test(text);
      text = text.replace(/[ \t]+$/, '');
      flush();
      if (hard) tokens.push({ t: 'node', node: { kind: 'break' } });
      else text += ' ';
      i += 1;
      continue;
    }

    // Code spans: a backtick run closed by an equally long run.
    if (ch === '`') {
      let runLen = 1;
      while (input[i + runLen] === '`') runLen += 1;
      const close = findCodeSpanClose(input, i + runLen, runLen);
      if (close !== -1) {
        flush();
        let code = input.slice(i + runLen, close).replace(/\n/g, ' ');
        if (code.length >= 2 && code.startsWith(' ') && code.endsWith(' ') && code.trim() !== '') {
          code = code.slice(1, -1);
        }
        tokens.push({ t: 'node', node: { kind: 'code', text: code } });
        i = close + runLen;
      } else {
        text += input.slice(i, i + runLen);
        i += runLen;
      }
      continue;
    }

    // Images / links / citations / reference links.
    const isImage = ch === PUNCT_BANG && input[i + 1] === '[';
    if ((ch === '[' && !insideLink) || isImage) {
      const parsed = parseBracketConstruct(input, i, isImage, ctx);
      if (parsed) {
        flush();
        tokens.push({ t: 'node', node: parsed.node });
        i = parsed.end;
        continue;
      }
    }

    // Fullwidth citation markers 【id】 (some models emit these).
    if (ch === '【') {
      const parsed = tryFullwidthCitation(input, i, ctx);
      if (parsed) {
        flush();
        tokens.push({ t: 'node', node: parsed.node });
        i = parsed.end;
        continue;
      }
    }

    // Emphasis / strike delimiter runs.
    if (ch === '*' || ch === '_' || ch === '~') {
      let runLen = 1;
      while (input[i + runLen] === ch) runLen += 1;
      const before = i > 0 ? input[i - 1] : undefined;
      const after = input[i + runLen];
      let canOpen = !isSpaceLike(after);
      let canClose = !isSpaceLike(before);
      if (ch === '_') {
        // No intraword emphasis for underscores (snake_case stays intact).
        if (isWordChar(before) && isWordChar(after)) {
          canOpen = false;
          canClose = false;
        }
      }
      if (ch === '~' && runLen < 2) {
        // Single tilde is plain text (20~25°C).
        text += input.slice(i, i + runLen);
        i += runLen;
        continue;
      }
      if (canOpen || canClose) {
        flush();
        tokens.push({ t: 'delim', marker: ch, length: runLen, canOpen, canClose });
      } else {
        text += input.slice(i, i + runLen);
      }
      i += runLen;
      continue;
    }

    // GFM-style autolinks (opt-in).
    if (ctx.options.autolink && (ch === 'h' || ch === 'H')) {
      const rest = input.slice(i);
      const match = /^https?:\/\/[^\s<>]+/i.exec(rest);
      if (match && !isWordChar(input[i - 1])) {
        const url = match[0].replace(/[.,;:!?)\]]+$/, '');
        flush();
        tokens.push({
          t: 'node',
          node: makeLink(url, undefined, [{ kind: 'text', text: url }], ctx)
        });
        i += url.length;
        continue;
      }
    }

    text += ch;
    i += 1;
  }
  flush();
  return tokens;
}

function findCodeSpanClose(input: string, from: number, runLen: number): number {
  let i = from;
  while (i < input.length) {
    if (input[i] === '`') {
      let len = 1;
      while (input[i + len] === '`') len += 1;
      if (len === runLen) return i;
      i += len;
    } else {
      i += 1;
    }
  }
  return -1;
}

// ── Bracket constructs: links, images, references, citations ────────────────

const CITATION_FULLWIDTH = /^【([^】\n]{1,64})】/;

function parseBracketConstruct(
  input: string,
  start: number,
  isImage: boolean,
  ctx: InlineContext
): { node: InlineNode; end: number } | null {
  const openBracket = isImage ? start + 1 : start;
  const closeBracket = findBracketClose(input, openBracket);
  if (closeBracket === -1) return null;
  const label = input.slice(openBracket + 1, closeBracket);
  const afterLabel = closeBracket + 1;

  // Inline destination: [label](dest "title")
  if (input[afterLabel] === '(') {
    const dest = parseDestination(input, afterLabel + 1);
    if (dest) {
      const node = isImage
        ? makeImage(dest.href, label, dest.title, ctx)
        : makeLink(dest.href, dest.title, parseLinkText(label, ctx), ctx);
      return { node, end: dest.end };
    }
    return null;
  }

  // Reference: [label][ref] — empty ref falls back to the label.
  if (input[afterLabel] === '[') {
    const refClose = input.indexOf(']', afterLabel + 1);
    if (refClose !== -1) {
      const refLabel = (input.slice(afterLabel + 1, refClose) || label).trim().toLowerCase();
      const def = ctx.linkRefs.get(refLabel);
      if (def) {
        const node = isImage
          ? makeImage(def.href, label, def.title, ctx)
          : makeLink(def.href, def.title, parseLinkText(label, ctx), ctx);
        return { node, end: refClose + 1 };
      }
      ctx.onUnresolvedRef?.(refLabel);
      return null;
    }
  }

  if (!isImage) {
    // Citation marker [id] — only for known ids, so prose like [1] survives.
    if (ctx.options.citationIds?.has(label)) {
      return { node: { kind: 'citation', id: label }, end: afterLabel };
    }
    // Shortcut reference [label].
    const shortcutLabel = label.trim().toLowerCase();
    const def = ctx.linkRefs.get(shortcutLabel);
    if (def) {
      return {
        node: makeLink(def.href, def.title, parseLinkText(label, ctx), ctx),
        end: afterLabel
      };
    }
    if (shortcutLabel.length > 0) ctx.onUnresolvedRef?.(shortcutLabel);
  }
  return null;
}

/** Parse citation markers of the form 【id】 (some models emit fullwidth brackets). */
export function tryFullwidthCitation(
  input: string,
  at: number,
  ctx: InlineContext
): { node: InlineNode; end: number } | null {
  const match = CITATION_FULLWIDTH.exec(input.slice(at));
  if (match && ctx.options.citationIds?.has(match[1])) {
    return { node: { kind: 'citation', id: match[1] }, end: at + match[0].length };
  }
  return null;
}

function findBracketClose(input: string, open: number): number {
  let depth = 0;
  for (let i = open; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '\\') {
      i += 1;
    } else if (ch === '[') {
      depth += 1;
    } else if (ch === ']') {
      depth -= 1;
      if (depth === 0) return i;
    } else if (ch === '\n' && input[i + 1] === '\n') {
      return -1;
    }
  }
  return -1;
}

function parseDestination(
  input: string,
  from: number
): { href: string; title?: string; end: number } | null {
  let i = from;
  while (i < input.length && /[ \t\n]/.test(input[i])) i += 1;
  let href = '';
  let depth = 0;
  if (input[i] === '<') {
    const close = input.indexOf('>', i + 1);
    if (close === -1) return null;
    href = input.slice(i + 1, close);
    i = close + 1;
  } else {
    while (i < input.length) {
      const ch = input[i];
      if (ch === '\\' && i + 1 < input.length) {
        href += input[i + 1];
        i += 2;
        continue;
      }
      if (/[\s]/.test(ch)) break;
      if (ch === '(') depth += 1;
      if (ch === ')') {
        if (depth === 0) break;
        depth -= 1;
      }
      href += ch;
      i += 1;
    }
  }
  while (i < input.length && /[ \t\n]/.test(input[i])) i += 1;
  let title: string | undefined;
  const quote = input[i];
  if (quote === '"' || quote === "'") {
    const close = input.indexOf(quote, i + 1);
    if (close === -1) return null;
    title = input.slice(i + 1, close);
    i = close + 1;
    while (i < input.length && /[ \t\n]/.test(input[i])) i += 1;
  }
  if (input[i] !== ')') return null;
  return { href, title, end: i + 1 };
}

/** Link text is parsed without nested links (CommonMark rule). */
function parseLinkText(label: string, ctx: InlineContext): InlineNode[] {
  return matchDelimiters(tokenize(label, ctx, true));
}

function makeLink(
  href: string,
  title: string | undefined,
  children: InlineNode[],
  ctx: InlineContext
): InlineNode {
  const check = checkLinkUrl(href, ctx.options.urlPolicy);
  if (check.ok) return { kind: 'link', href: check.href, title, children };
  return { kind: 'link', href: '', title, children, blocked: true };
}

function makeImage(
  src: string,
  alt: string,
  title: string | undefined,
  ctx: InlineContext
): InlineNode {
  const check = checkImageUrl(src, ctx.options.urlPolicy);
  if (check.ok) return { kind: 'image', src: check.href, alt, title };
  return { kind: 'image', src: '', alt, title, blocked: true };
}

// ── Delimiter matching (emphasis / strong / strike) ──────────────────────────

interface OpenDelim {
  tokenIndex: number;
  marker: '*' | '_' | '~';
  remaining: number;
}

function matchDelimiters(tokens: Token[]): InlineNode[] {
  // Resolve delimiter pairs into explicit open/close instructions, innermost
  // first, then build the tree in a single walk.
  const opens: OpenDelim[] = [];
  type Span = {
    openToken: number;
    closeToken: number;
    openLen: number;
    kind: 'em' | 'strong' | 'strike';
  };
  const spans: Span[] = [];
  const consumedOpen = new Map<number, number>();
  const consumedClose = new Map<number, number>();

  tokens.forEach((token, index) => {
    if (token.t !== 'delim') return;
    let remainingClose = token.length;
    if (token.canClose) {
      while (remainingClose > 0) {
        const openerIdx = findOpener(opens, token.marker);
        if (openerIdx === -1) break;
        const opener = opens[openerIdx];
        const isStrike = token.marker === '~';
        const take = isStrike ? 2 : Math.min(2, opener.remaining, remainingClose);
        if (isStrike && (opener.remaining < 2 || remainingClose < 2)) break;
        spans.push({
          openToken: opener.tokenIndex,
          closeToken: index,
          openLen: take,
          kind: isStrike ? 'strike' : take === 2 ? 'strong' : 'em'
        });
        opener.remaining -= take;
        remainingClose -= take;
        consumedOpen.set(opener.tokenIndex, (consumedOpen.get(opener.tokenIndex) ?? 0) + take);
        consumedClose.set(index, (consumedClose.get(index) ?? 0) + take);
        // Discard younger openers of other markers (CommonMark rule) — this
        // keeps resolved spans strictly nested, which the tree walk relies on.
        opens.splice(openerIdx + 1);
        if (opener.remaining === 0) opens.splice(openerIdx, 1);
      }
    }
    if (token.canOpen && remainingClose > 0) {
      opens.push({ tokenIndex: index, marker: token.marker, remaining: remainingClose });
    } else if (remainingClose > 0) {
      // Unmatched closer with no opening ability → renders literally later.
    }
  });

  // Build tree: walk tokens, entering/leaving spans at their token indices.
  // Spans are properly nested by construction (stack discipline above).
  const byOpen = new Map<number, Span[]>();
  const byClose = new Map<number, Span[]>();
  for (const span of spans) {
    push(byOpen, span.openToken, span);
    push(byClose, span.closeToken, span);
  }

  const root: InlineNode[] = [];
  const stack: { span: Span; children: InlineNode[] }[] = [];
  const sink = () => (stack.length > 0 ? stack[stack.length - 1].children : root);

  tokens.forEach((token, index) => {
    if (token.t === 'delim') {
      const closing = (byClose.get(index) ?? []).sort((a, b) => b.openToken - a.openToken);
      for (const span of closing) {
        while (stack.length > 0) {
          const top = stack.pop();
          if (!top) break;
          const node: InlineNode =
            top.span.kind === 'strong'
              ? { kind: 'strong', children: top.children }
              : top.span.kind === 'em'
                ? { kind: 'em', children: top.children }
                : { kind: 'strike', children: top.children };
          sink().push(node);
          if (top.span === span) break;
        }
      }
      const literalLen =
        token.length - (consumedOpen.get(index) ?? 0) - (consumedClose.get(index) ?? 0);
      if (literalLen > 0) {
        appendText(sink(), token.marker.repeat(literalLen));
      }
      const opening = (byOpen.get(index) ?? []).sort((a, b) => b.closeToken - a.closeToken);
      for (const span of opening) {
        stack.push({ span, children: [] });
      }
      return;
    }
    if (token.t === 'text') {
      appendText(sink(), token.text);
      return;
    }
    sink().push(token.node);
  });

  // Unclosed spans render literally: unwind, re-inserting the literal marker.
  while (stack.length > 0) {
    const top = stack.pop();
    if (!top) break;
    const marker = top.span.kind === 'strike' ? '~~' : top.span.kind === 'strong' ? '**' : '*';
    const target = sink();
    appendText(target, marker);
    for (const child of top.children) {
      if (child.kind === 'text') appendText(target, child.text);
      else target.push(child);
    }
  }
  return mergeText(root);
}

function findOpener(opens: OpenDelim[], marker: '*' | '_' | '~'): number {
  for (let i = opens.length - 1; i >= 0; i -= 1) {
    if (opens[i].marker === marker) return i;
  }
  return -1;
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

function appendText(target: InlineNode[], text: string): void {
  if (text.length === 0) return;
  const last = target[target.length - 1];
  if (last && last.kind === 'text') last.text += text;
  else target.push({ kind: 'text', text });
}

function mergeText(nodes: InlineNode[]): InlineNode[] {
  return nodes;
}
