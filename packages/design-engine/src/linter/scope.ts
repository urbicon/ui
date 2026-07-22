/**
 * The code view — the input slice the `'code'`-scoped deterministic rules scan
 * (see {@link RuleScope} in types.ts). It resolves the "quoting ≠ violating"
 * problem: the class-utility rules used to regex the whole file, so a docs or
 * marketing page that *shows* an anti-pattern in prose (`✗ [raw-tailwind-color]
 * \`bg-green-500\`` as rendered linter output, `focus:ring-2` in a paragraph)
 * failed the gate exactly like a page that commits it.
 *
 * The view is a same-length string (offsets and line numbers identical to the
 * source) in which only class-bearing content survives:
 *
 *  - `class="…"` string-attribute values (any attribute whose name contains
 *    "class": `class`, `slotClasses`, a consumer's `inputClass`, …) — verbatim,
 *    so Svelte's `class="gap-{x}"` interpolation stays visible;
 *  - `class:name` directive names (the part after `class:` is a real class);
 *  - string/template literals inside every `{…}` expression attribute
 *    (`class={cond ? 'a' : 'b'}`, `slotClasses={{ base: '…' }}`) — with their
 *    delimiters, so quote-anchored rules (deep-internal-import) keep matching;
 *  - string/template literals in `<script>` bodies (tv() configs, class maps,
 *    import specifiers);
 *  - string/template literals inside `{…}` template expressions in text position
 *    (`{@const cls = '…'}`, `{#snippet row(cls = '…')}`);
 *  - `@apply …` declaration values in `<style>` blocks.
 *
 * Everything else — element text content (prose), comments, `style=` attributes
 * (CSS custom properties like `--room-accent-fg` are not class utilities),
 * non-class string attributes (`aria-label`, `placeholder`, `href`, …), and CSS
 * outside `@apply` — is blanked.
 *
 * Sensitivity contract: every place a class string can *actually take effect*
 * is kept, so no real violation found by the old whole-file scan in a
 * class-bearing position is lost (guarded by scope.test.ts's regression pair).
 * Like `markup.ts`, the builder is conservative: what it cannot parse it leaves
 * blanked, which can only silence, never invent, a finding.
 */

import { readBraced, scanMarkup } from './markup.js';
import type { LintMode } from './types.js';

/** A kept [start, end) span of the source. */
type Span = readonly [number, number];

const blankRegion = (s: string): string => s.replace(/[^\n]/g, ' ');

/** Attribute names whose string values carry classes. */
function isClassAttrName(name: string): boolean {
  return name.toLowerCase().includes('class');
}

/** `style` / `style:prop` — CSS values, never class utilities. */
function isStyleAttrName(name: string): boolean {
  return name === 'style' || name.startsWith('style:');
}

/** After one of these, a `/` starts a regex literal, not division (heuristic). */
function regexCanFollow(prev: string): boolean {
  return prev === '' || !/[\w$)\]"'`]/.test(prev);
}

/** From the opening quote at `i`, index past the closing quote (or the newline/end on unterminated). */
function scanString(src: string, i: number, end: number): number {
  const quote = src[i];
  let j = i + 1;
  while (j < end) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === quote) return j + 1;
    if (c === '\n') return j; // unterminated — stop at the line break, never swallow what follows
    j++;
  }
  return end;
}

/** From the `{` at `i`, index past the matching `}`, skipping strings/templates inside. */
function skipBraces(src: string, i: number, end: number): number {
  let depth = 0;
  let j = i;
  while (j < end) {
    const c = src[j];
    if (c === '"' || c === "'") {
      j = scanString(src, j, end);
      continue;
    }
    if (c === '`') {
      j = scanTemplate(src, j, end);
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return j + 1;
    }
    j++;
  }
  return end;
}

/** From the opening backtick at `i`, index past the closing backtick, honouring `${…}` nesting. */
function scanTemplate(src: string, i: number, end: number): number {
  let j = i + 1;
  while (j < end) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '`') return j + 1;
    if (c === '$' && src[j + 1] === '{') {
      j = skipBraces(src, j + 1, end);
      continue;
    }
    j++;
  }
  return end;
}

/** From the `/` at `i`, index past the regex literal (or past the newline when it was division after all). */
function scanRegex(src: string, i: number, end: number): number {
  let j = i + 1;
  let inClass = false;
  while (j < end) {
    const c = src[j];
    if (c === '\\') {
      j += 2;
      continue;
    }
    if (c === '\n') return j; // no regex spans a line — misjudged division, bail
    if (c === '[') inClass = true;
    else if (c === ']') inClass = false;
    else if (c === '/' && !inClass) return j + 1;
    j++;
  }
  return end;
}

/**
 * Collect the spans of every string/template literal (delimiters included) in
 * the code region `[start, end)`. Skips line and block comments and regex
 * literals so a quote inside them never opens a phantom string (which could
 * swallow — and thereby hide — a real literal after it).
 */
export function collectLiteralSpans(src: string, start: number, end: number, out: Span[]): void {
  let i = start;
  let prev = ''; // last significant char, for the regex-vs-division heuristic
  while (i < end) {
    const c = src[i];
    if (c === undefined) break;
    if (c === '"' || c === "'") {
      const j = scanString(src, i, end);
      out.push([i, j]);
      prev = '"';
      i = j;
      continue;
    }
    if (c === '`') {
      const j = scanTemplate(src, i, end);
      out.push([i, j]);
      prev = '`';
      i = j;
      continue;
    }
    if (c === '/') {
      const n = src[i + 1];
      if (n === '/') {
        while (i < end && src[i] !== '\n') i++;
        continue;
      }
      if (n === '*') {
        const close = src.indexOf('*/', i + 2);
        i = close === -1 || close + 2 > end ? end : close + 2;
        continue;
      }
      if (regexCanFollow(prev)) {
        i = scanRegex(src, i, end);
        prev = '/';
        continue;
      }
      prev = '/';
      i++;
      continue;
    }
    if (!/\s/.test(c)) prev = c;
    i++;
  }
}

/** Body spans of every `<script>`/`<style>` block (comments already blanked upstream). */
function blockBodySpans(src: string, tag: 'script' | 'style'): Span[] {
  const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)</${tag}>`, 'gi');
  const spans: Span[] = [];
  for (const m of src.matchAll(re)) {
    const bodyStart = (m.index ?? 0) + (m[1] ?? '').length;
    spans.push([bodyStart, bodyStart + (m[2] ?? '').length]);
  }
  return spans;
}

/** Materialise kept spans over an all-blank canvas (newlines preserved → offsets/lines identical). */
function materialise(src: string, spans: Span[]): string {
  const out = blankRegion(src).split('');
  for (const [start, end] of spans) {
    for (let p = Math.max(0, start); p < Math.min(end, src.length); p++) {
      const c = src[p];
      if (c !== undefined && c !== '\n') out[p] = c;
    }
  }
  return out.join('');
}

/**
 * Build the code view for one source (see the module doc). `mode: 'code'` treats
 * the whole input as a TS/JS module (every literal kept); `mode: 'markup'`
 * applies the Svelte/HTML document semantics.
 */
export function buildCodeView(source: string, mode: LintMode): string {
  const spans: Span[] = [];
  if (mode === 'code') {
    collectLiteralSpans(source, 0, source.length, spans);
    return materialise(source, spans);
  }

  // Structure discovery on a comment-blanked copy so a commented-out `<script>`
  // or a `{` inside `<!-- … -->` never opens a phantom region.
  const noComments = source.replace(/<!--[\s\S]*?-->/g, blankRegion);
  const scriptBodies = blockBodySpans(noComments, 'script');
  const styleBodies = blockBodySpans(noComments, 'style');

  // 1. Script bodies: string/template literals (tv() configs, imports, class maps).
  for (const [s, e] of scriptBodies) collectLiteralSpans(source, s, e, spans);

  // 2. Style bodies: only `@apply` declaration values are class-bearing.
  for (const [s, e] of styleBodies) {
    const body = source.slice(s, e);
    for (const m of body.matchAll(/@apply\s+[^;{}]+/g)) {
      spans.push([s + (m.index ?? 0), s + (m.index ?? 0) + m[0].length]);
    }
  }

  // 3. Element attributes (scanMarkup blanks comments/script/style itself, so its
  //    offsets refer to the same coordinate space).
  const elements = scanMarkup(source);
  for (const el of elements) {
    for (const attr of el.attrs) {
      if (attr.valueStart === undefined || attr.valueEnd === undefined) continue;
      if (isStyleAttrName(attr.name)) continue; // CSS values, not classes
      if (attr.kind === 'string') {
        if (isClassAttrName(attr.name)) spans.push([attr.valueStart, attr.valueEnd]);
      } else {
        // expression / spread / shorthand — JS code: keep its literals.
        collectLiteralSpans(source, attr.valueStart, attr.valueEnd, spans);
      }
      if (attr.name.startsWith('class:') && attr.nameStart !== undefined) {
        // The directive's class lives in the attribute *name*.
        spans.push([attr.nameStart + 'class:'.length, attr.nameStart + attr.name.length]);
      }
    }
  }

  // 4. `{…}` template expressions in text position ({@const cls = '…'}, snippet
  //    params) are code too. Walk the markup area (comments/script/style blanked),
  //    skipping the open-tag spans already handled above.
  let markupMasked = noComments;
  for (const [s, e] of [...scriptBodies, ...styleBodies]) {
    markupMasked =
      markupMasked.slice(0, s) + blankRegion(markupMasked.slice(s, e)) + markupMasked.slice(e);
  }
  const openSpans = elements
    .map((el): Span => [el.openStart, el.openEnd])
    .sort((a, b) => a[0] - b[0]);
  let next = 0;
  let i = 0;
  while (i < markupMasked.length) {
    while (next < openSpans.length && (openSpans[next]?.[1] ?? 0) <= i) next++;
    const open = openSpans[next];
    if (open && i >= open[0]) {
      i = open[1]; // inside an opening tag — attrs handled structurally above
      continue;
    }
    if (markupMasked[i] === '{') {
      const { end } = readBraced(markupMasked, i);
      if (end !== -1) {
        collectLiteralSpans(source, i + 1, end - 1, spans);
        i = end;
        continue;
      }
    }
    i++;
  }

  return materialise(source, spans);
}
