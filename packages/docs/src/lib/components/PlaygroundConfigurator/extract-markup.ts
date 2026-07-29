/**
 * Reads a playground's own source and lifts out the markup its demo puts
 * *inside* the component.
 *
 * `codeSetup` closed the gap for demos whose content is data — it prints the
 * very objects the preview renders. It cannot reach content that is **markup**:
 * a Card's header and footer snippets, a SplitPane's two panes, the
 * `<SegmentItem>`s inside a SegmentGroup. Those snippets read `<Card />`, which
 * is true and useless.
 *
 * The obvious patch — a hand-written `children` string in `codeSetup` — would
 * reintroduce the second, drifting copy the whole change removed. So the
 * `{#snippet children}` body *is* the source of truth: a playground passes its
 * own text (`import playgroundSource from './Playground.svelte?raw'`) and this
 * lifts the component's children out of it verbatim.
 *
 * Deliberately **only the children**. The opening tag stays generated from the
 * live control values, because that is what keeps default props out of the
 * snippet — a reader wants `<Card variant="outlined">`, not every prop the
 * component has.
 *
 * What it will not do is guess. An identifier in the markup that the snippet
 * cannot resolve (a `const` from the playground's script that `codeSetup` does
 * not declare) makes the extraction fail loudly via {@link ExtractResult.unresolved}
 * rather than print code that does not run.
 */

export interface ExtractResult {
  /** The children, de-indented — or `null` when there are none to show. */
  markup: string | null;
  /**
   * Identifiers the markup refers to that the snippet has no declaration for.
   * Non-empty means the caller must drop the markup: printing it would hand a
   * reader code referring to names that are not there.
   */
  unresolved: string[];
}

/** Index of the `>` that closes the tag opening at `from`, brace- and quote-aware. */
function closeOfOpeningTag(src: string, from: number): { end: number; selfClosing: boolean } {
  let depth = 0;
  let quote = '';
  for (let i = from; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '{') depth++;
    else if (ch === '}') depth--;
    else if (ch === '>' && depth === 0) {
      return { end: i, selfClosing: src[i - 1] === '/' };
    }
  }
  return { end: -1, selfClosing: false };
}

/** Index of the `</name>` that closes the element opened at `from`, nesting-aware. */
function closeOfElement(src: string, from: number, name: string): number {
  const open = new RegExp(`<${name}\\b`, 'g');
  const close = `</${name}>`;
  let depth = 1;
  let cursor = from;
  while (cursor < src.length) {
    open.lastIndex = cursor;
    const nextOpen = open.exec(src);
    const nextClose = src.indexOf(close, cursor);
    if (nextClose === -1) return -1;
    if (nextOpen && nextOpen.index < nextClose) {
      // A self-closing nested tag never needs a matching close.
      const { selfClosing } = closeOfOpeningTag(src, nextOpen.index);
      if (!selfClosing) depth++;
      cursor = nextOpen.index + 1;
      continue;
    }
    depth--;
    if (depth === 0) return nextClose;
    cursor = nextClose + close.length;
  }
  return -1;
}

/** Drop the common leading whitespace, so the snippet starts at column 0. */
function dedent(block: string): string {
  const lines = block.replace(/^\n/, '').replace(/\s+$/, '').split('\n');
  const indents = lines
    .filter((l) => l.trim() !== '')
    .map((l) => l.match(/^[ \t]*/)?.[0].length ?? 0);
  const common = indents.length > 0 ? Math.min(...indents) : 0;
  return lines.map((l) => l.slice(common)).join('\n');
}

/** Replace string literal bodies with spaces — their contents are not code. */
function blankStrings(text: string): string {
  return text.replace(/(['"`])(?:\\.|(?!\1)[^\\])*\1/g, (m) => ' '.repeat(m.length));
}

/**
 * Top-level `const`/`let`/`function` names in the playground's `<script>`.
 *
 * This is the only set worth checking, and framing it this way avoids guessing
 * at JavaScript: an earlier version scanned every identifier in the markup and
 * had to special-case globals, block bindings, arrow parameters and object
 * keys — it still reported `x`, `y`, `v` and `i` from `demo.map((v, i) => ({ x,
 * y }))` as missing. A name the *playground* declares is exactly the kind the
 * snippet has to declare too; everything else is either syntax, a local, or
 * part of the standard library.
 */
function scriptDeclarations(source: string): Set<string> {
  const scriptEnd = source.indexOf('</script>');
  const script = scriptEnd < 0 ? '' : source.slice(0, scriptEnd);
  const names = new Set<string>();
  for (const m of script.matchAll(/^\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of script.matchAll(/^\s*function\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return names;
}

/**
 * `{@const}` bindings the snippet body declares **before** the component tag.
 *
 * They are in scope for the markup but sit outside what gets extracted, so a
 * copied snippet would not have them — exactly as unavailable as a script
 * const. Alert is the live case: `{@const { children: description } = values}`
 * above the tag, `{description}` inside it.
 */
function bindingsAboveTag(bodyBeforeTag: string): Set<string> {
  const names = new Set<string>();
  for (const m of bodyBeforeTag.matchAll(/\{@const\s+([\s\S]*?)=/g)) {
    // Covers plain `x =` as well as destructuring, where every name on the left
    // is bound — including renames, whose *new* name is the one in scope.
    const target = m[1];
    if (/^[A-Za-z_$][\w$]*\s*$/.test(target)) {
      names.add(target.trim());
      continue;
    }
    for (const part of target.matchAll(
      /(?:^|[,{[])\s*(?:[A-Za-z_$][\w$]*\s*:\s*)?([A-Za-z_$][\w$]*)/g
    )) {
      names.add(part[1]);
    }
  }
  return names;
}

/**
 * Which of the playground's own declarations the markup actually refers to.
 * Only text inside `{…}` counts — an attribute *name* is not a reference, and
 * string contents are blanked so `title="demo"` never matches a `demo` const.
 */
function referencedDeclarations(markup: string, declarations: Set<string>): Set<string> {
  const found = new Set<string>();
  if (declarations.size === 0) return found;
  let depth = 0;
  let start = 0;
  for (let i = 0; i < markup.length; i++) {
    const ch = markup[i];
    if (ch === '{') {
      if (depth === 0) start = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        const expr = blankStrings(markup.slice(start, i));
        for (const m of expr.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)/g)) {
          if (declarations.has(m[1])) found.add(m[1]);
        }
      }
    }
  }
  return found;
}

/**
 * Lift the children of `componentName` out of a playground's source.
 *
 * @param source the playground file's own text (`?raw`)
 * @param componentName the component the playground documents
 * @param declared names the generated snippet declares itself (a `codeSetup`'s
 * `consts`, `state` and `bind` entries), which are therefore resolvable
 */
export function extractChildMarkup(
  source: string,
  componentName: string,
  declared: readonly string[] = []
): ExtractResult {
  const none: ExtractResult = { markup: null, unresolved: [] };

  const snippetAt = source.indexOf('{#snippet children(');
  if (snippetAt < 0) return none;
  const headerEnd = source.indexOf('}', snippetAt);
  const bodyEnd = source.lastIndexOf('{/snippet}');
  if (headerEnd < 0 || bodyEnd < headerEnd) return none;
  const body = source.slice(headerEnd + 1, bodyEnd);

  const tagAt = body.search(new RegExp(`<${componentName}\\b`));
  if (tagAt < 0) return none;
  const { end, selfClosing } = closeOfOpeningTag(body, tagAt);
  if (end < 0 || selfClosing) return none;

  const closeAt = closeOfElement(body, end + 1, componentName);
  if (closeAt < 0) return none;

  const markup = dedent(body.slice(end + 1, closeAt));
  if (markup.trim() === '') return none;

  // Everything in scope for the markup that a copied snippet would not have:
  // the playground's script, plus the bindings its snippet made above the tag.
  const outOfReach = scriptDeclarations(source);
  for (const name of bindingsAboveTag(body.slice(0, tagAt))) outOfReach.add(name);

  const known = new Set(declared);
  const unresolved = [...referencedDeclarations(markup, outOfReach)]
    .filter((name) => !known.has(name))
    .sort();
  return { markup, unresolved };
}
