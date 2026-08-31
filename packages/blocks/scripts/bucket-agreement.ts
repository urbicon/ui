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
 * model Tailwind either. It asks the design system for each candidate's AST and
 * reads the properties out of it, then reports:
 *
 *   - `findUnbucketed` — a class the compiler writes properties for that the
 *     table buckets as `null`; the resolver is silent about it;
 *   - `findCollisions` — a bucket holding classes with DIFFERENT
 *     declared-property sets; the table claims a conflict the compiler does not
 *     back.
 *
 * **The two take different populations, because their blind spots are
 * disjoint.** `getClassList` enumerates the static and theme-driven names only:
 * 35 140 of them, and **no** arbitrary value and **no** variant-prefixed form
 * (measured — `stroke-2` is in it, `stroke-[2px]`, `scale-[1.01]` and
 * `active:scale-95` are not, and all three are live library classes). So the
 * collision half is asked about the catalogue *and* the shipped classes, while
 * the unbucketed half is asked only about what the library ships: over the
 * catalogue it reports 13 242 classes in families this library never writes,
 * which is a fact about Tailwind's breadth, not a defect.
 *
 * The property set is the whole set the rule declares, custom properties
 * included: `scale-150` writes `--tw-scale-x/y/z` + `scale` while
 * `scale-z-150` writes only `--tw-scale-z` + `scale`, and without the
 * variables those two read as one effect.
 *
 * **Why the AST and not the stylesheet.** An earlier version compiled the
 * classes to CSS and attributed each rule back to a class by its selector.
 * That needs a CSS scanner and a selector-to-candidate matching step, and both
 * were wrong in ways that fail silently: escaped quotes in a selector
 * (`.after\:content-\[\'\*\'\]::after`) read as a string desynced the
 * scanner and dropped the 399 classes emitted after that rule, and a raw `;`
 * inside `url(x.svg?a=1;phantom:none)` invented a `phantom` property, which
 * would surface as a bucket disagreement whose documented remedy is a fabricated
 * exemption. `candidatesToAst` returns one AST **per candidate**, so there is no
 * selector text to parse and no attribution step to lose the thread: the answer
 * is keyed by the index it was asked with.
 */

/** The `DesignSystem` surface this module needs — see `__unstable__loadDesignSystem`. */
export type CandidateAstSource = {
  candidatesToAst(candidates: readonly string[]): (AstNode[] | null)[];
};

/** The second `DesignSystem` surface — Tailwind's own catalogue of class names. */
export type ClassCatalogueSource = {
  getClassList(): readonly (readonly [string, unknown])[];
};

/**
 * Every class name Tailwind can name for this theme — the input the collision
 * half needs and the shipped classes cannot give it, since a table over-reach
 * outside the library's own vocabulary still ships to every consumer.
 */
export function catalogueClasses(design: ClassCatalogueSource): string[] {
  return design.getClassList().map(([cls]) => cls);
}

type AstNode =
  | { kind: 'declaration'; property: string }
  | { kind: 'at-rule'; name: string; nodes?: AstNode[] }
  | { kind: string; nodes?: AstNode[] };

/**
 * Every property name declared below `node`, custom properties included.
 *
 * `@property` blocks are skipped: Tailwind emits them beside a utility to
 * register the variables it composes with, and their `syntax` / `inherits` /
 * `initial-value` declarations belong to the registration, not to what the
 * class writes on the element. Every other at-rule (`@media`, `@supports`)
 * wraps real declarations and is walked into.
 */
function collectProperties(node: AstNode, into: Set<string>): void {
  if (node.kind === 'declaration') {
    into.add((node as { property: string }).property);
    return;
  }
  if (node.kind === 'at-rule' && (node as { name: string }).name === '@property') return;
  for (const child of node.nodes ?? []) collectProperties(child, into);
}

/**
 * Map each of `classes` to the CSS properties its rules declare.
 *
 * A class Tailwind produces no rule for is simply absent — that is the
 * emitted-CSS guard's finding, not this one's.
 */
export function collectClassEffects(
  design: CandidateAstSource,
  classes: readonly string[]
): Map<string, string[]> {
  const asts = design.candidatesToAst(classes);
  const effects = new Map<string, string[]>();
  for (const [i, cls] of classes.entries()) {
    const properties = new Set<string>();
    for (const node of asts[i] ?? []) collectProperties(node, properties);
    if (properties.size > 0) effects.set(cls, [...properties].sort());
  }
  return effects;
}

export type UnbucketedFinding = { cls: string; properties: string[] };

/**
 * How the declared-property sets in one bucket relate — the triage order for
 * the report, derived rather than guessed:
 *
 *   - `disjoint` — no two sets share a property, so neither class can replace
 *     the other and the bucket always strips something for nothing. An
 *     over-reach by construction.
 *   - `nested` — every pair is comparable (one set contains the other), the
 *     shape of a composition: `truncate` writes what `text-ellipsis` writes and
 *     two more, and the shared bucket is what keeps `truncate text-clip` from
 *     leaving the ellipsis behind.
 *   - `overlap` — sets intersect without containment; a human has to look.
 *
 * The sort is empirical, not a proof: on the table this gate first ran against,
 * all 6 `disjoint` buckets were real over-reaches and all 11 `nested` ones were
 * legitimate, leaving 2 in `overlap` (`gradient-via`, `outline-style`).
 */
export type EffectRelation = 'disjoint' | 'nested' | 'overlap';

export type CollisionFinding = {
  bucket: string;
  /** one entry per distinct declared-property set, largest group first */
  effects: { properties: string[]; classes: string[] }[];
  /** how many classes the bucket holds in total */
  total: number;
  relation: EffectRelation;
};

/**
 * Classes the compiler writes properties for that the table buckets as `null`.
 *
 * `bucket` is `utils/variants.ts`'s own `tailwindBucket`, not a copy of it —
 * a gate that restated the table would only ever agree with itself.
 */
export function findUnbucketed(
  effects: ReadonlyMap<string, string[]>,
  bucket: (cls: string) => string | null
): UnbucketedFinding[] {
  const unbucketed: UnbucketedFinding[] = [];
  for (const [cls, properties] of effects) {
    if (bucket(cls) == null) unbucketed.push({ cls, properties });
  }
  return unbucketed.sort((a, b) => a.cls.localeCompare(b.cls));
}

function relate(sets: readonly (readonly string[])[]): EffectRelation {
  let anyShared = false;
  let allComparable = true;
  for (let i = 0; i < sets.length; i++) {
    for (let j = i + 1; j < sets.length; j++) {
      const a = new Set(sets[i]);
      const b = new Set(sets[j]);
      if (![...a].some((p) => b.has(p))) {
        // A disjoint pair is not a containment, so it rules `nested` out too.
        allComparable = false;
        continue;
      }
      anyShared = true;
      if (![...a].every((p) => b.has(p)) && ![...b].every((p) => a.has(p))) allComparable = false;
    }
  }
  if (!anyShared) return 'disjoint';
  return allComparable ? 'nested' : 'overlap';
}

/**
 * Buckets holding classes whose declared-property sets differ — the table
 * claims a conflict the compiler does not back.
 */
export function findCollisions(
  effects: ReadonlyMap<string, string[]>,
  bucket: (cls: string) => string | null
): CollisionFinding[] {
  const byBucket = new Map<string, Map<string, string[]>>();
  for (const [cls, properties] of effects) {
    const key = bucket(cls);
    if (key == null) continue;
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
      total: effectList.reduce((n, e) => n + e.classes.length, 0),
      relation: relate(effectList.map((e) => e.properties))
    });
  }
  return collisions.sort((a, b) => a.bucket.localeCompare(b.bucket));
}
