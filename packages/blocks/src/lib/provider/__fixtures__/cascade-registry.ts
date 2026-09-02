import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Component } from 'svelte';
import { parse } from 'svelte/compiler';

/**
 * Who takes part in the provider-cascade sweep, and with which slot names —
 * both read out of the source, never listed here.
 *
 * Three facts come from the code and none of them can be hand-maintained
 * without the list and the code drifting apart:
 *
 * - a component is public iff the package barrel exports the very module
 *   object the file default-exports (compared by identity, not by name);
 * - its prop names come from the `Props` INTERFACE, not from the `$props()`
 *   destructuring: the interface is what a consumer writes against, and a
 *   component can declare `unstyled` there and let it ride `...rest` into
 *   whichever child the spread happens to reach. Reading the destructuring
 *   made exactly that shape invisible to every route that gates on the prop
 *   (measured on `ConfirmDialog`: its two footer Buttons stayed dressed under
 *   `<ConfirmDialog unstyled>` and route H skipped it as "declares no
 *   `unstyled` prop"). The destructured names are unioned in, so a prop a
 *   component takes without typing it still counts;
 * - its provider name is the string literal it passes to `resolveSlotClasses`,
 *   or to `setWrapperCascade` where it hands the name to the component it wraps
 *   — without one it cannot be addressed from a provider's `defaults` at all;
 * - its slot names come from the `tv()` configs it composes from, read through
 *   the `.config` the engine exposes, because `Object.keys(config.slots)` is
 *   where the engine itself gets them — and, for a wrapper, from the component
 *   it hands its cascade to, which composes them on its behalf.
 *
 * The condition object is deliberately *not* read here. It is captured at
 * mount time from the real `resolveSlotClasses` call, so its keys and the
 * values a component carries in that mount both come from the running
 * component rather than from a parse of an object literal that has prose in it.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
/** `src/lib`, two levels up from `provider/__fixtures__`. */
const LIB = resolve(HERE, '../..');

/** Loosely typed on purpose: the sweep mounts every component through one
 * host, so the props it hands over are only known at runtime. */
type AnyComponent = Component<Record<string, unknown>>;

// Discovery is bounded by these two directories: a component added under a new
// `src/lib/<dir>` would be exported, styled, and silently outside the sweep.
// Measured on this tree — the 368 barrel exports outside them are icons and
// infrastructure, and the only `.svelte` elsewhere declaring an `unstyled` prop
// is `provider/BlocksProvider.svelte`, which owns the flag rather than obeying
// it. (`internal/core/*` name `unstyled` in prose only, which is why the scan
// that established this had to strip comments first.)
const componentLoaders = import.meta.glob<{ default: AnyComponent }>(
  '../../{components,primitives}/**/*.svelte'
);
const variantLoaders = import.meta.glob<Record<string, unknown>>('../../**/*variants*.ts');

const abs = (globKey: string) => resolve(HERE, globKey);

const componentsByPath = new Map(
  Object.entries(componentLoaders).map(([key, load]) => [abs(key), load])
);

/**
 * The provider name of a component: the string literal it hands
 * `resolveSlotClasses(config, 'Name', …)`, or — for a wrapper, which resolves
 * nothing itself and passes its name down instead — `setWrapperCascade('Name',
 * …)`. One pattern for both, so the name is found wherever a component declares
 * one; a name this misses is a component the whole sweep skips.
 *
 * First match wins, which is what an inner component needs: it resolves the
 * wrapper's name before its own, but reads that one off `cascade.component`
 * rather than a literal, so the first literal here is still its own.
 */
export const PROVIDER_NAME =
  /(?:resolveSlotClasses\(\s*[A-Za-z_$][\w$]*\s*,|setWrapperCascade\()\s*'([^']+)'/;
/** The destructuring pattern of the component's own `$props()` call. */
const PROPS_CALL = /let\s*\{([\s\S]*?)\}\s*(?::[^=]*)?=\s*\$props\(\)/;
/**
 * The type annotation on that call — `}: ButtonProps = $props()`, and equally
 * `}: ComboboxProps<T> = $props()`. `[^=]*` rather than a balanced `<…>`
 * because a type ARGUMENT never carries a `=` (only a type *parameter* has a
 * default), and the four generic components were the ones that fell out when
 * this pattern demanded the name and the `=` be adjacent.
 */
const PROPS_TYPE = /\}\s*:\s*([A-Za-z_$][\w$]*)[^=]*=\s*\$props\(\)/;
/** `import { X, type Y } from './index'` — where a Props interface may live. */
const IMPORT_CLAUSE = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'([^']+)'/g;
/** Any identifier the source uses — matched against the tv() export index. */
const IDENTIFIER = /\b[A-Za-z_$][\w$]*\b/g;

export interface CascadeComponent {
  /** Provider name — the key a `defaults` entry is written under, if any. */
  providerName: string | null;
  /** The identifier the package barrel exports this component as. */
  exportName: string;
  /** Every slot name the tv() configs this component composes from declare. */
  slots: string[];
  /** Every class token those configs can emit — what `unstyled` has to drop. */
  libraryTokens: Set<string>;
  /**
   * Prop names of the component's public contract: every member its `Props`
   * interface declares (own + local bases, `Omit`/`Pick` honoured), unioned
   * with what `$props()` destructures.
   */
  declaredProps: string[];
  component: AnyComponent;
}

/**
 * Strip comments before scanning for names. Not cosmetic: the components put
 * prose *inside* the object literals and argument lists this file reads, so an
 * unstripped scan takes words out of a sentence for prop names.
 */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** Top-level identifiers of a destructuring pattern (`a = 1, b: c, ...rest`). */
function destructuredNames(pattern: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of pattern) {
    if ('{[('.includes(char)) depth++;
    else if ('}])'.includes(char)) depth--;
    if (char === ',' && depth === 0) {
      names.push(current);
      current = '';
    } else current += char;
  }
  names.push(current);
  return names
    .map((entry) => entry.trim())
    .filter((entry) => entry && !entry.startsWith('...'))
    .map((entry) => entry.split(/[:=]/)[0].trim())
    .filter((entry) => /^[A-Za-z_$][\w$]*$/.test(entry));
}

/**
 * Members a component's Props TYPE declares, following `extends` and the
 * branches of a union alias — through `Omit<…>` / `Pick<…>` — as far as the
 * declarations under `src/lib` reach.
 *
 * Three declaration shapes, because the package uses all three and the first
 * version of this resolver only understood one:
 *
 *  - `interface X { … }` — own members plus every base;
 *  - `interface X<T> extends Y` — the type-parameter list is stripped first.
 *    Without that, `header[1]` starts with `<T …>` rather than `extends`, the
 *    whole clause parses as one unnamed base and is dropped: measured, that
 *    silently lost `ComboboxSingleProps`' and `PlannerProps`' ONLY base;
 *  - `type X = A | B` — every branch contributes. TypeScript would offer a
 *    consumer only the intersection, but the question here is whether the
 *    contract mentions `unstyled` at all, and a prop on one branch is a prop
 *    the component has to honour on that branch.
 *
 * Bases from outside the library (`HTMLButtonAttributes` & co.) contribute
 * nothing on purpose. They carry the whole DOM attribute surface, `class`
 * included, and a component that means to accept a *merged* `class` redeclares
 * it locally next to `Omit<HTML…Attributes, 'class'>` — the convention
 * COMPONENT-API-CONVENTIONS.md sets. Counting the DOM bag instead would put
 * `class` on every component in the package and send route E after elements no
 * component ever hands it to.
 */
function membersOf(
  typeName: string,
  file: string,
  sourceOf: (path: string) => string | undefined,
  resolveSpecifier: (specifier: string, from: string) => string | undefined,
  seen = new Set<string>()
): Set<string> {
  const members = new Set<string>();
  const key = `${file}#${typeName}`;
  if (seen.has(key)) return members;
  seen.add(key);
  const source = sourceOf(file);
  if (!source) return members;

  // Where each imported name comes from, so a base in a sibling component's
  // index.ts is followed rather than dropped.
  const origin = new Map<string, string>();
  for (const clause of source.matchAll(IMPORT_CLAUSE)) {
    const target = resolveSpecifier(clause[2], file);
    if (!target) continue;
    for (const name of clause[1].split(',')) {
      const bare = name
        .trim()
        .replace(/^type\s+/, '')
        .split(/\s+as\s+/)[0]
        .trim();
      if (bare) origin.set(bare, target);
    }
  }

  /** One type reference — `Foo`, `Foo<T>`, `Omit<Foo, 'a' | 'b'>`, `Pick<…>`. */
  const fromRef = (ref: string): void => {
    const utility = ref.trim().match(/^(Omit|Pick)\s*<([\s\S]*)>$/);
    if (utility) {
      const [inner, ...keyParts] = splitTopLevel(utility[2]);
      const keys = new Set(
        keyParts
          .join(',')
          .split('|')
          .map((k) => k.trim().replace(/^'|'$/g, ''))
      );
      const innerName = inner.trim().split(/[<\s]/)[0];
      for (const member of membersOf(
        innerName,
        origin.get(innerName) ?? file,
        sourceOf,
        resolveSpecifier,
        seen
      )) {
        if (utility[1] === 'Omit' ? !keys.has(member) : keys.has(member)) members.add(member);
      }
      return;
    }
    const name = ref.trim().split(/[<\s]/)[0];
    if (!name || !/^[A-Z]/.test(name)) return;
    for (const member of membersOf(
      name,
      origin.get(name) ?? file,
      sourceOf,
      resolveSpecifier,
      seen
    )) {
      members.add(member);
    }
  };

  const header = source.match(
    new RegExp(`(?:export\\s+)?interface\\s+${typeName}\\b([^{]*)\\{`, 'm')
  );
  if (header) {
    const bodyStart = (header.index ?? 0) + header[0].length;
    let depth = 1;
    let end = bodyStart;
    while (end < source.length && depth > 0) {
      if (source[end] === '{') depth++;
      else if (source[end] === '}') depth--;
      end++;
    }
    const body = source.slice(bodyStart, end - 1);
    for (const member of body.matchAll(
      /(?:^|\n)\s*(?:readonly\s+)?'?([A-Za-z_$][\w$-]*)'?\s*\??\s*:/g
    )) {
      members.add(member[1]);
    }
    const clause = stripTypeParams(header[1]).replace(/^\s*extends\s*/, '');
    for (const base of splitTopLevel(clause)) fromRef(base);
    return members;
  }

  // No interface — a `type X<…> = A | B;` alias. Walked rather than matched:
  // a type-parameter DEFAULT contains an `=` (`<T extends SelectValue =
  // string>`), so a regex that reads "up to the first `=`" lands inside the
  // parameter list. Measured: that is what left `ComboboxProps` and
  // `SelectProps` resolving to nothing.
  const alias = source.match(new RegExp(`(?:export\\s+)?type\\s+${typeName}\\b`, 'm'));
  if (!alias) return members;
  let cursor = (alias.index ?? 0) + alias[0].length;
  while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
  if (source[cursor] === '<') {
    let params = 0;
    for (; cursor < source.length; cursor++) {
      if (source[cursor] === '<') params++;
      else if (source[cursor] === '>' && --params === 0) {
        cursor++;
        break;
      }
    }
  }
  while (cursor < source.length && /\s/.test(source[cursor])) cursor++;
  if (source[cursor] !== '=') return members;
  cursor++;
  let depth = 0;
  let rhs = '';
  for (; cursor < source.length; cursor++) {
    const char = source[cursor];
    if ('<([{'.includes(char)) depth++;
    else if ('>)]}'.includes(char)) depth--;
    else if (char === ';' && depth === 0) break;
    rhs += char;
  }
  for (const branch of splitTopLevel(rhs, /[|&]/)) fromRef(branch);
  return members;
}

/** Drop a leading `<…>` type-parameter list, brackets balanced. */
function stripTypeParams(clause: string): string {
  const text = clause.trimStart();
  if (!text.startsWith('<')) return clause;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '<') depth++;
    else if (text[i] === '>') {
      depth--;
      if (depth === 0) return text.slice(i + 1);
    }
  }
  return clause;
}

/** Split a type argument / extends / union list on a top-level separator. */
function splitTopLevel(text: string, separator: RegExp = /,/): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const char of text) {
    if ('<([{'.includes(char)) depth++;
    else if ('>)]}'.includes(char)) depth--;
    if (depth === 0 && separator.test(char)) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  if (current.trim()) parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

interface TvFacts {
  slots: string[];
  tokens: string[];
}

/** Every string leaf of a tv() config value, split into class tokens. */
function collectTokens(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    for (const token of value.split(/\s+/)) if (token) into.add(token);
  } else if (Array.isArray(value)) {
    for (const entry of value) collectTokens(entry, into);
  } else if (value && typeof value === 'object') {
    for (const entry of Object.values(value)) collectTokens(entry, into);
  }
}

/**
 * Export name → the tv() facts of its module, over every module whose filename
 * carries `variants`. Indexed by export name rather than by import path
 * because a component may pull its resolver through the package barrel
 * (`buttonVariants` from `$lib/primitives`), where the path says nothing.
 */
async function buildTvIndex(): Promise<Map<string, TvFacts>> {
  const index = new Map<string, TvFacts>();
  for (const [key, load] of Object.entries(variantLoaders)) {
    if (/\.(test|spec)\.ts$/.test(key)) continue;
    const module = await load();
    const slots = new Set<string>();
    const tokens = new Set<string>();
    for (const exported of Object.values(module)) {
      const config = (exported as { config?: Record<string, unknown> })?.config;
      if (!config) continue;
      if (config.slots) for (const slot of Object.keys(config.slots as object)) slots.add(slot);
      // `defaultVariants` holds axis *values* ('md'), not classes — collecting
      // it would put words into the token set that no stylesheet ever emits.
      const { defaultVariants: _ignored, ...classBearing } = config;
      collectTokens(classBearing, tokens);
    }
    if (slots.size === 0 && tokens.size === 0) continue;
    const facts: TvFacts = { slots: [...slots], tokens: [...tokens] };
    for (const name of Object.keys(module)) index.set(name, facts);
  }
  return index;
}

/**
 * The union of what the component's Props interface declares and what its
 * `$props()` call destructures. Either alone is a smaller contract than the
 * one a consumer can write against.
 */
function contractProps(
  path: string,
  code: string,
  sourceOf: (file: string) => string | undefined,
  resolveSpecifier: (specifier: string, from: string) => string | undefined
): string[] {
  const names = new Set(destructuredNames(code.match(PROPS_CALL)?.[1] ?? ''));
  const typeName = code.match(PROPS_TYPE)?.[1];
  if (typeName) {
    // The annotation names a type this file imported, or declared itself.
    let declaringFile = path;
    for (const clause of code.matchAll(IMPORT_CLAUSE)) {
      const imported = clause[1].split(',').map((name) =>
        name
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)
          .pop()
          ?.trim()
      );
      if (!imported.includes(typeName)) continue;
      declaringFile = resolveSpecifier(clause[2], path) ?? path;
    }
    for (const member of membersOf(typeName, declaringFile, sourceOf, resolveSpecifier)) {
      names.add(member);
    }
  }
  return [...names];
}

/**
 * Every node of a given `type` in a Svelte AST, found by walking the object
 * graph rather than by knowing its shape — the block and snippet nodes that
 * hold a component tag differ per construct, and enumerating them is the same
 * kind of guess this function exists to stop making.
 */
function collectNodes(
  node: unknown,
  type: string,
  out: Record<string, unknown>[],
  seen: WeakSet<object>
): void {
  if (!node || typeof node !== 'object') return;
  if (seen.has(node)) return;
  seen.add(node);
  if (Array.isArray(node)) {
    for (const item of node) collectNodes(item, type, out, seen);
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.type === type) out.push(record);
  for (const value of Object.values(record)) collectNodes(value, type, out, seen);
}

/** The names a `.svelte` source imports, and the component tags it renders. */
export interface SvelteEdges {
  /** Export names, so an aliased named import still reads as what it is. */
  imported: Set<string>;
  tags: Set<string>;
}

/**
 * Read a component's outgoing edges off the Svelte compiler's own parse.
 *
 * Asking the parser is the whole point: in a `.svelte` file "not code" is a far
 * larger set than JavaScript's, and every text scan here has been wrong about
 * a different member of it. Measured, each silently giving `NumberInput` the
 * full `Select` vocabulary (10 slots to 22): an attribute VALUE
 * (`aria-roledescription="Select a number"`), an ordinary markup comment above
 * the stepper snippet — `<!-- -->` is the mandatory comment form in Svelte
 * markup and this file already carries one — plain markup text, a regex
 * literal, a dashed attribute NAME, and `{#each}` body text. A strip excludes
 * the vector last found; a parse excludes the category.
 *
 * The parse also answers the second kind of non-edge, which no scan of any
 * depth could: a name that *is* a real identifier in a real import and still
 * renders nothing — a type import, either spelling, and a namespace binding.
 *
 * Throws on a source it cannot parse rather than falling back to a scan: a
 * component the compiler rejects is not a component, and a quiet fallback here
 * would reinstate exactly the silence this replaced.
 */
export function svelteEdges(source: string): SvelteEdges {
  const ast = parse(source, { modern: true }) as unknown as Record<string, unknown>;
  const imported = new Set<string>();
  const tags = new Set<string>();

  const declarations: Record<string, unknown>[] = [];
  collectNodes(ast.instance, 'ImportDeclaration', declarations, new WeakSet());
  collectNodes(ast.module, 'ImportDeclaration', declarations, new WeakSet());
  for (const declaration of declarations) {
    // A type import renders nothing, so it is no edge. `importKind` sits on the
    // declaration for `import type { X }` and on the specifier for
    // `import { type X }`; both spellings reach here.
    if (declaration.importKind === 'type') continue;
    for (const specifier of (declaration.specifiers ?? []) as Record<string, unknown>[]) {
      if (specifier.importKind === 'type') continue;
      // A namespace binding is never a component — `import * as Select` names
      // the module, not an export of it — while a default binding is the only
      // name its import has.
      if (specifier.type === 'ImportNamespaceSpecifier') continue;
      // A named import carries the export name in `imported`; a default import
      // has only the local binding, which is the importer's choice — a renamed
      // one drops the edge, and that is the loud direction.
      const source_ =
        specifier.type === 'ImportSpecifier'
          ? (specifier.imported as { name?: string })?.name
          : (specifier.local as { name?: string })?.name;
      if (source_) imported.add(source_);
    }
  }

  const components: Record<string, unknown>[] = [];
  collectNodes(ast.fragment, 'Component', components, new WeakSet());
  for (const node of components) if (typeof node.name === 'string') tags.add(node.name);

  return { imported, tags };
}

/**
 * Which cascade-consuming components a source names, in code.
 *
 * Exported for `cascade-registry.test.ts`, the only positive control this
 * derivation can have: a wrong edge *widens* a slot vocabulary, so every sweep
 * that consumes it stays green — measured on both text-scan defects above,
 * with `provider-cascade` and `boolean-conditions` at 881 passing throughout.
 */
export function namedConsumers(source: string, consumers: Iterable<string>): string[] {
  const wanted = new Set(consumers);
  const { imported, tags } = svelteEdges(source);
  return [...new Set([...imported, ...tags])].filter((name) => wanted.has(name));
}

let cache: Promise<CascadeComponent[]> | undefined;

/**
 * Every component the package exports, in stable export-name order.
 * A component the barrel does not export is not part of the contract.
 */
export function exportedComponents(): Promise<CascadeComponent[]> {
  cache ??= (async () => {
    const [barrel, tvIndex] = await Promise.all([import('$lib'), buildTvIndex()]);
    const exportNameByModule = new Map<unknown, string>();
    for (const [name, value] of Object.entries(barrel)) {
      if (typeof value === 'function' && /^[A-Z]/.test(name)) exportNameByModule.set(value, name);
    }

    // Read once per file: the interface graph revisits index.ts files.
    const sources = new Map<string, string | undefined>();
    const sourceOf = (file: string): string | undefined => {
      if (!sources.has(file)) {
        try {
          sources.set(file, stripComments(readFileSync(file, 'utf8')));
        } catch {
          sources.set(file, undefined);
        }
      }
      return sources.get(file);
    };
    // `./index` → index.ts, `../Dialog/index` → that file, `$lib/x` → src/lib/x.
    // Anything else (a bare module specifier) resolves to nothing, which is what
    // keeps `svelte/elements` out of the member set.
    const resolveSpecifier = (specifier: string, from: string): string | undefined => {
      let base: string;
      if (specifier === '$lib') base = join(LIB, 'index');
      else if (specifier.startsWith('$lib/')) base = join(LIB, specifier.slice('$lib/'.length));
      else if (specifier.startsWith('.')) base = resolve(dirname(from), specifier);
      else return undefined;
      for (const candidate of [base, `${base}.ts`, join(base, 'index.ts')]) {
        if (candidate.endsWith('.ts') && sourceOf(candidate) !== undefined) return candidate;
      }
      return undefined;
    };

    interface Scan {
      path: string;
      code: string;
      edges: SvelteEdges;
      exportName: string;
      slots: Set<string>;
      libraryTokens: Set<string>;
      component: AnyComponent;
    }

    const scans: Scan[] = [];
    for (const [path, load] of componentsByPath) {
      const component = (await load()).default;
      const exportName = exportNameByModule.get(component);
      if (!exportName) continue;

      const raw = readFileSync(path, 'utf8');
      const code = stripComments(raw);
      // Off the raw source: `stripComments` knows JavaScript's comment forms,
      // and the parser has to see the file the compiler sees.
      const edges = svelteEdges(raw);
      const slots = new Set<string>();
      const libraryTokens = new Set<string>();
      for (const [identifier] of code.matchAll(IDENTIFIER)) {
        const facts = tvIndex.get(identifier);
        if (!facts) continue;
        for (const slot of facts.slots) slots.add(slot);
        for (const token of facts.tokens) libraryTokens.add(token);
      }
      scans.push({ path, code, edges, exportName, slots, libraryTokens, component });
    }

    // A wrapper composes no tv() config of its own — it hands its name to the
    // one component it wraps, and that component's slots and class tokens are
    // what a `defaults` entry under the wrapper's name is written in. The edge
    // is read off the source like everything else here: the wrapped side is the
    // component whose body calls `consumeWrapperCascade`, the wrapping side is
    // the one whose source both sets a cascade and names that component. Both
    // halves come off the parse (`svelteEdges`): which side a component is on
    // is which of the two functions it imports, and "names" is an import
    // specifier or a rendered tag — never a word in a comment or a string.
    // `namedConsumers` carries the positive control; nothing downstream can
    // report a wrong edge.
    const consumers = new Map<string, Scan>();
    for (const scan of scans) {
      if (scan.edges.imported.has('consumeWrapperCascade')) consumers.set(scan.exportName, scan);
    }
    for (const scan of scans) {
      if (!scan.edges.imported.has('setWrapperCascade')) continue;
      const named = [...scan.edges.imported, ...scan.edges.tags];
      for (const name of named) {
        const inner = consumers.get(name);
        if (!inner) continue;
        for (const slot of inner.slots) scan.slots.add(slot);
        for (const token of inner.libraryTokens) scan.libraryTokens.add(token);
      }
    }

    const found: CascadeComponent[] = scans.map((scan) => ({
      providerName: scan.code.match(PROVIDER_NAME)?.[1] ?? null,
      exportName: scan.exportName,
      // A tv() config without `slots` routes its classes to `base`, and that
      // is the key such a component reads off the resolved record.
      slots: scan.slots.size > 0 ? [...scan.slots] : ['base'],
      libraryTokens: scan.libraryTokens,
      declaredProps: contractProps(scan.path, scan.code, sourceOf, resolveSpecifier),
      component: scan.component
    }));
    return found.sort((a, b) => a.exportName.localeCompare(b.exportName));
  })();
  return cache;
}
