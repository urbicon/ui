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
