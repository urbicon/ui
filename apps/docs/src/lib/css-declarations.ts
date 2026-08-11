/**
 * Reading custom properties out of a stylesheet, and following what they read:
 * one parser plus one dependency walk, shared by every docs module that treats
 * the shipped CSS as data — the Token Reference tables
 * ($lib/interaction-tokens.ts) and the theme previews ($lib/theme-preview.ts).
 *
 * They had a parser each, with the same shape and different bugs: one scanned
 * to EOF when a declaration was missing its `;` and swallowed the rest of the
 * file as a value, the other took the LAST declaration of a name where its own
 * docstring promised the first. Both read `@media` blocks as if they were base
 * values, which publishes `--blocks-touch-target-min` — a token that exists
 * only under `(pointer: coarse)` — as a library default.
 *
 * The contract, in one place:
 *
 *   - comments are stripped first, so prose naming a token (`… --color-primary-200
 *     to --color-primary-800 …`) cannot be read as a declaration;
 *   - a value scans to the `;` at paren-depth zero, so relative-color syntax
 *     (`oklch(from var(--x) l c h)`), `color-mix()` and multi-layer shadows
 *     survive intact instead of being truncated at the first inner `)`;
 *   - a value may also end at the `}` closing its block — CSS allows the last
 *     declaration of a block to drop its semicolon;
 *   - a scan that reaches EOF without either DISCARDS the declaration rather
 *     than keeping a value that runs to the end of the file;
 *   - every declaration carries the brace depth it was found at, so a caller
 *     can ask for base values only (depth 1: an `@theme` block or a top-level
 *     `:root`) and leave the at-rule overrides alone.
 */

export interface Declaration {
  name: string;
  /** Whitespace-collapsed, `;`-free. */
  value: string;
  /**
   * Brace nesting depth of the block the declaration sits in. 1 is a top-level
   * rule — `@theme { … }` or `:root { … }` — i.e. a base value. 2 and deeper
   * means an at-rule wrapper (`@media print { :root { … } }`), whose values are
   * conditional and must not be published as defaults.
   */
  depth: number;
  /** Ordinal in document order, so callers can emit a stable, source-shaped list. */
  index: number;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/**
 * Every custom-property declaration in document order, duplicates included.
 * See the module header for the scan contract.
 */
export function parseDeclarations(css: string): Declaration[] {
  const source = stripComments(css);
  const head = /(--[a-z0-9-]+)\s*:/y;
  const out: Declaration[] = [];
  let depth = 0;

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }
    if (ch !== '-' || source[i + 1] !== '-') continue;

    head.lastIndex = i;
    const match = head.exec(source);
    if (!match) continue;

    const start = head.lastIndex;
    let parens = 0;
    let end = start;
    let terminated = false;
    for (; end < source.length; end++) {
      const c = source[end];
      if (c === '(') parens++;
      else if (c === ')') parens--;
      else if (parens === 0 && (c === ';' || c === '}')) {
        terminated = true;
        break;
      }
    }
    // Unterminated at EOF: the value would be "everything left in the file".
    // Drop it rather than publish that.
    if (!terminated) break;

    out.push({
      name: match[1],
      value: source.slice(start, end).trim().replace(/\s+/g, ' '),
      depth,
      index: out.length
    });
    // Resume ON the terminator, so a closing `}` still decrements the depth.
    i = end - 1;
  }

  return out;
}

/**
 * The base values only: depth-1 declarations, first occurrence wins.
 *
 * First-wins is what a browser resolves to for the file shapes here — the base
 * `:root`/`@theme` block leads and the at-rule re-declarations follow — and the
 * depth filter is what keeps those at-rule blocks out in the first place. A
 * name declared twice at depth 1 in one file would be a bug in that file, not a
 * case to model.
 */
export function baseDeclarations(sources: string[]): Declaration[] {
  const seen = new Set<string>();
  const out: Declaration[] = [];
  for (const css of sources) {
    for (const declaration of parseDeclarations(css)) {
      if (declaration.depth !== 1 || seen.has(declaration.name)) continue;
      seen.add(declaration.name);
      out.push({ ...declaration, index: out.length });
    }
  }
  return out;
}

/** Every custom property a value reads through `var()`. */
export function references(value: string): string[] {
  return [...value.matchAll(/var\(\s*(--[a-z0-9-]+)/g)].map((m) => m[1]);
}

/**
 * A set of stylesheets indexed for dependency walks: every base declaration,
 * plus — per token name — the declarations whose value reads it.
 */
export interface TokenGraph {
  declarations: Declaration[];
  dependents: Map<string, Declaration[]>;
}

export function buildTokenGraph(sources: string[]): TokenGraph {
  const declarations = baseDeclarations(sources);
  const dependents = new Map<string, Declaration[]>();
  for (const declaration of declarations) {
    for (const name of new Set(references(declaration.value))) {
      const list = dependents.get(name);
      if (list) list.push(declaration);
      else dependents.set(name, [declaration]);
    }
  }
  return { declarations, dependents };
}

/**
 * Every declaration that has to be repeated in a scope which overrides
 * `overridden` — the transitive closure of "reads something we changed",
 * in document order.
 *
 * Why a closure rather than a list: a custom property substitutes its `var()`
 * references where it is DECLARED, so re-pointing a ramp on a container leaves
 * every `:root`-declared token that reads it on the value it computed up there.
 * Repeating the declaration verbatim in the new scope is what makes it resolve
 * against the new value — and each repeat changes another name, which is the
 * next round of the walk.
 *
 * Names already in `overridden` are never returned: the caller emits its own
 * value for those, and repeating the library's would undo it.
 */
export function derivedDeclarations(
  graph: TokenGraph,
  overridden: Iterable<string>
): Declaration[] {
  const covered = new Set(overridden);
  const queue = [...covered];
  const found: Declaration[] = [];
  while (queue.length > 0) {
    const name = queue.pop() as string;
    for (const declaration of graph.dependents.get(name) ?? []) {
      if (covered.has(declaration.name)) continue;
      covered.add(declaration.name);
      found.push(declaration);
      queue.push(declaration.name);
    }
  }
  return found.sort((a, b) => a.index - b.index);
}
