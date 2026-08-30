/**
 * bucket-agreement — ask the compiler whether the hand-written conflict table
 * still agrees with it.
 *
 * `utils/variants.ts` decides which of two classes setting the same CSS
 * property survives the fold from `BUCKET_PATTERNS` — 218 regexes that
 * restate Tailwind's namespace by hand. Where the restatement has a gap the
 * resolver returns `null`, both classes survive, and the compiled
 * stylesheet's emit order decides: the exact state the fold exists to remove.
 * Where it over-reaches, two classes that write different properties share a
 * bucket and one is stripped for nothing (`text-2xs` read as a colour and lost
 * to `text-primary`, fixed in dba97fe8).
 *
 * Neither direction is visible from the table itself, so this module does not
 * model Tailwind either. It reads the stylesheet Tailwind just compiled,
 * records which CSS properties each class declares, and reports:
 *
 *   - a class the compiler writes properties for that the table buckets as
 *     `null` — the resolver is silent about it;
 *   - a bucket holding classes with DIFFERENT declared-property sets — the
 *     table claims a conflict the compiler does not back.
 *
 * The property set is the whole set the rule declares, custom properties
 * included: `scale-150` writes `--tw-scale-x/y/z` + `scale` while
 * `scale-z-150` writes only `--tw-scale-z` + `scale`, and without the
 * variables those two read as one effect.
 *
 * Pure string-in/string-out apart from `escapeClass` — no Bun APIs, no
 * compiler, importable from vitest.
 */

import { escapeClass } from './tailwind-emit';

/** Characters that end a class name inside a selector (see `emitsRuleFor`). */
const SELECTOR_BOUNDARY = /[\s,{:>~+.[)]/;

/**
 * The first `.class` token of a selector, escapes intact, or null when the
 * selector names no class at all.
 *
 * Not "the selector's leading token": `space-x-*` and `divide-*` compile to
 * `:where(.-space-x-4 > :not(:last-child))`, so the class sits inside a
 * functional pseudo. The first class token is the utility's own in every
 * shape Tailwind emits — the `.group` of a `group-hover:` rule comes later,
 * inside the trailing `:is(:where(.group):hover *)`.
 *
 * Escapes are consumed whole, and the CSS hex form matters: a class starting
 * with a digit is written `.\32 xl\:px-4` — one escape spanning `\`, the hex
 * digits and the terminating space. Reading that space as a boundary would cut
 * the token to `.\32` and attribute the rule to nothing.
 */
export function firstClassSelector(selector: string): string | null {
  for (let dot = selector.indexOf('.'); dot !== -1; dot = selector.indexOf('.', dot + 1)) {
    let i = dot + 1;
    while (i < selector.length) {
      const ch = selector[i];
      if (ch === '\\') {
        i++;
        let hex = 0;
        while (i < selector.length && hex < 6 && /[0-9a-fA-F]/.test(selector[i])) {
          i++;
          hex++;
        }
        if (hex === 0) i++;
        else if (/\s/.test(selector[i] ?? '')) i++;
        continue;
      }
      if (SELECTOR_BOUNDARY.test(ch)) break;
      i++;
    }
    if (i > dot + 1) return selector.slice(dot, i);
  }
  return null;
}

type Block = { prelude: string; body: string };

/**
 * Index of the next character to read, given that `src[i]` opens a CSS
 * construct that must be consumed whole.
 *
 * The backslash case is the one that decides whether this module works at all.
 * In a DECLARATION `'…'` is a string; in a SELECTOR the same quote is an
 * escaped identifier character — `content-['*']` compiles to the selector
 * `.after\:content-\[\'\*\'\]::after`. Treating `\'` as a string escape makes
 * the scanner walk past the closing quote and desync for the rest of the
 * stylesheet: measured, it silently lost the 399 classes emitted after that
 * one rule, every one of them variant-prefixed. A backslash outside a string
 * escapes exactly one character, so it is consumed first and no quote it
 * carries can open one.
 */
function skipOpaque(src: string, i: number): number {
  const ch = src[i];
  if (ch === '\\') return i + 2;
  if (ch === '/' && src[i + 1] === '*') {
    const end = src.indexOf('*/', i + 2);
    return end === -1 ? src.length : end + 2;
  }
  if (ch === '"' || ch === "'") {
    let j = i + 1;
    while (j < src.length && src[j] !== ch) j += src[j] === '\\' ? 2 : 1;
    return j + 1;
  }
  return i;
}

/**
 * Split one CSS block body into its nested blocks and its own declarations.
 */
function splitBlock(src: string): { blocks: Block[]; declarations: string[] } {
  const blocks: Block[] = [];
  const declarations: string[] = [];
  let start = 0;
  let i = 0;
  while (i < src.length) {
    const skipped = skipOpaque(src, i);
    if (skipped !== i) {
      i = skipped;
      continue;
    }
    const ch = src[i];
    if (ch === '{') {
      let depth = 1;
      let j = i + 1;
      while (j < src.length && depth > 0) {
        const jumped = skipOpaque(src, j);
        if (jumped !== j) {
          j = jumped;
          continue;
        }
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      blocks.push({ prelude: src.slice(start, i).trim(), body: src.slice(i + 1, j - 1) });
      i = j;
      start = j;
      continue;
    }
    if (ch === ';') {
      declarations.push(src.slice(start, i));
      i++;
      start = i;
      continue;
    }
    i++;
  }
  const tail = src.slice(start).trim();
  if (tail) declarations.push(tail);
  return { blocks, declarations };
}

/** The property names a declaration list writes (custom properties included). */
function propertyNames(declarations: string[]): string[] {
  const names: string[] = [];
  for (const decl of declarations) {
    const colon = decl.indexOf(':');
    if (colon === -1) continue;
    const name = decl.slice(0, colon).trim();
    if (/^(?:--)?[a-zA-Z-][\w-]*$/.test(name)) names.push(name);
  }
  return names;
}

/** Every property name declared anywhere below `body`, at any nesting depth. */
function propertiesBelow(body: string): string[] {
  const { blocks, declarations } = splitBlock(body);
  const names = propertyNames(declarations);
  for (const block of blocks) names.push(...propertiesBelow(block.body));
  return names;
}

/**
 * Map each of `classes` to the CSS properties its rules declare in `css`.
 *
 * A class with no entry got no rule at all — that is the emitted-CSS guard's
 * finding, not this one's, so it is simply absent here.
 */
export function collectClassEffects(
  css: string,
  classes: readonly string[]
): Map<string, string[]> {
  const bySelector = new Map<string, string>();
  for (const cls of classes) bySelector.set(`.${escapeClass(cls)}`, cls);

  const effects = new Map<string, Set<string>>();
  const walk = (body: string) => {
    for (const block of splitBlock(body).blocks) {
      if (block.prelude.startsWith('@')) {
        // At-rule: `@media`/`@supports` wrap the utilities they gate.
        // `@property`/`@keyframes` declare no class rules, so recursing into
        // them finds nothing to attribute.
        walk(block.body);
        continue;
      }
      const selector = firstClassSelector(block.prelude);
      const cls = selector == null ? undefined : bySelector.get(selector);
      if (cls == null) continue;
      let set = effects.get(cls);
      if (!set) {
        set = new Set();
        effects.set(cls, set);
      }
      for (const name of propertiesBelow(block.body)) set.add(name);
    }
  };
  walk(css);

  return new Map([...effects].map(([cls, set]) => [cls, [...set].sort()]));
}

export type UnbucketedFinding = { cls: string; properties: string[] };
export type CollisionFinding = {
  bucket: string;
  /** one entry per distinct declared-property set, largest group first */
  effects: { properties: string[]; classes: string[] }[];
  /** how many classes the bucket holds in total */
  total: number;
};

/**
 * Compare the hand table against the effects the compiler reported.
 *
 * `bucket` is `utils/variants.ts`'s own `tailwindBucket`, not a copy of it —
 * a gate that restated the table would only ever agree with itself.
 */
export function compareBuckets(
  effects: ReadonlyMap<string, string[]>,
  bucket: (cls: string) => string | null
): { unbucketed: UnbucketedFinding[]; collisions: CollisionFinding[] } {
  const unbucketed: UnbucketedFinding[] = [];
  const byBucket = new Map<string, Map<string, string[]>>();

  for (const [cls, properties] of effects) {
    const key = bucket(cls);
    if (key == null) {
      unbucketed.push({ cls, properties });
      continue;
    }
    let groups = byBucket.get(key);
    if (!groups) {
      groups = new Map();
      byBucket.set(key, groups);
    }
    const signature = properties.join(' ');
    const members = groups.get(signature);
    if (members) members.push(cls);
    else groups.set(signature, [cls]);
  }

  const collisions: CollisionFinding[] = [];
  for (const [key, groups] of byBucket) {
    if (groups.size < 2) continue;
    const effectList = [...groups]
      .map(([signature, classes]) => ({
        properties: signature ? signature.split(' ') : [],
        classes: classes.sort()
      }))
      .sort((a, b) => b.classes.length - a.classes.length);
    collisions.push({
      bucket: key,
      effects: effectList,
      total: effectList.reduce((n, e) => n + e.classes.length, 0)
    });
  }

  unbucketed.sort((a, b) => a.cls.localeCompare(b.cls));
  collisions.sort((a, b) => a.bucket.localeCompare(b.bucket));
  return { unbucketed, collisions };
}
