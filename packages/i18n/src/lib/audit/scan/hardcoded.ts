/**
 * Hardcoded-string lint (Feature C) — surface literal UI copy in `.svelte` markup
 * that was never routed through i18n. Heuristic and therefore ADVISORY by default
 * (the CLI gates it only on opt-in): it flags plain markup text and a small set of
 * human-readable attributes (`aria-label`, `title`, `placeholder`, `alt`), skips
 * code-shaped strings and key chords (`⌘ K`), and never looks inside
 * `<script>`/`<style>` (those hold no Text/Attribute AST nodes) or a `<T>`
 * component (already translated).
 */

import { makeGlobMatcher } from '../glob';
import { makeContextAt, makeLineAt } from './recognize';
import { asNodes, asString, loadParse, walkAst } from './svelte-ast';

const DEFAULT_ATTRIBUTES = ['aria-label', 'title', 'placeholder', 'alt'];

// Keyboard glyphs live in the Arrows, Miscellaneous Technical and Control Pictures
// blocks; uppercase copy carrying one (`NEXT →`, `⌘ ENTER`) passes the lowercase gate
// too — accepted, because source copy keeps its lowercase and uppercasing is CSS.
const KEY_GLYPH = /[←-⇿⌀-⏿␀-␿]/;

export interface HardcodedFinding {
  file: string;
  line: number;
  /** The offending literal, trimmed. */
  text: string;
  /** Markup text content, or a flagged attribute value. */
  kind: 'text' | 'attribute';
  /** The attribute name when `kind === 'attribute'`. */
  attribute?: string;
  context: string;
}

export interface FindHardcodedOptions {
  /** Exact strings or `prefix*` globs to never flag. */
  ignoreStrings?: string[];
  /** Attribute names to check (default: aria-label, title, placeholder, alt). */
  attributes?: string[];
  /** Length window for a candidate (default 3–80). */
  minLength?: number;
  maxLength?: number;
}

/** Does a trimmed string read like human UI copy rather than code/identifiers/data? */
function looksLikeCopy(text: string, min: number, max: number): boolean {
  if (text.length < min || text.length > max) return false;
  if (!/[a-zA-Z]/.test(text)) return false; // needs a letter
  if (/^https?:\/\//.test(text)) return false; // URL
  if (/^[\w.-]+@[\w.-]+$/.test(text)) return false; // email
  if (/^[A-Z0-9_]+$/.test(text)) return false; // CONST_CASE
  if (/^\w+(\.\w+)+$/.test(text)) return false; // dotted key / filename
  if (/^[a-z][a-zA-Z0-9]*$/.test(text)) return false; // single camelCase token (variable-ish)
  if (/^[\d\s.,:;/–—-]+$/.test(text)) return false; // numbers / dates / separators
  if (/[{}<>=]/.test(text)) return false; // markup/code fragments
  if (!/[a-z]/.test(text) && KEY_GLYPH.test(text)) return false; // key chord (⌘ K)
  return true;
}

export async function findHardcodedStrings(
  code: string,
  file: string,
  options: FindHardcodedOptions = {}
): Promise<HardcodedFinding[]> {
  const parse = await loadParse();
  const ast = parse(code, { modern: true });
  const lineAt = makeLineAt(code);
  const contextAt = makeContextAt(code);
  const checked = new Set(
    (options.attributes ?? DEFAULT_ATTRIBUTES).map((name) => name.toLowerCase())
  );
  const isIgnored = makeGlobMatcher(options.ignoreStrings);
  const min = options.minLength ?? 3;
  const max = options.maxLength ?? 80;

  const findings: HardcodedFinding[] = [];
  const seen = new Set<string>(); // dedupe identical text@line
  const skipText = new WeakSet<object>(); // attribute-value Text + <T> subtree Text

  const consider = (
    text: string | undefined,
    line: number,
    kind: 'text' | 'attribute',
    attribute?: string
  ) => {
    const trimmed = text?.trim();
    if (!trimmed || isIgnored(trimmed) || !looksLikeCopy(trimmed, min, max)) return;
    const id = `${line}:${trimmed}`;
    if (seen.has(id)) return;
    seen.add(id);
    findings.push({ file, line, text: trimmed, kind, attribute, context: contextAt(line) });
  };

  // Pass 1 — attributes (and collect Text to exclude from the markup pass). Text/
  // Attribute nodes exist only in the template, so walking the whole Root is safe.
  walkAst(ast, (node) => {
    if (node.type === 'Attribute') {
      const values = asNodes(node.value);
      for (const value of values) if (value.type === 'Text') skipText.add(value);
      const name = asString(node.name)?.toLowerCase();
      const single = values.length === 1 ? values[0] : undefined;
      if (name && checked.has(name) && single?.type === 'Text') {
        consider(asString(single.data), lineAt(node.start ?? 0), 'attribute', name);
      }
    } else if (node.type === 'Component' && asString(node.name) === 'T') {
      walkAst(node, (inner) => {
        if (inner.type === 'Text') skipText.add(inner);
      });
    }
  });

  // Pass 2 — markup text not already claimed by an attribute or a <T> subtree.
  walkAst(ast, (node) => {
    if (node.type === 'Text' && !skipText.has(node)) {
      consider(asString(node.data), lineAt(node.start ?? 0), 'text');
    }
  });

  findings.sort((a, b) => a.line - b.line || a.text.localeCompare(b.text));
  return findings;
}
