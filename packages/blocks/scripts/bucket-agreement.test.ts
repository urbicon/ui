import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { beforeAll, describe, expect, it } from 'vitest';
import { tailwindBucket } from '../src/lib/utils/variants';
import {
  CATALOGUE_CANARIES,
  type CandidateAstSource,
  type ClassCatalogueSource,
  catalogueClasses,
  collectClassEffects,
  findCollisions,
  findUnbucketed
} from './bucket-agreement';

/**
 * The bucket-agreement pass reads which CSS properties each class declares from
 * the design system's per-candidate AST. Its failure mode is silence in both
 * halves: a reader that returns nothing reports no disagreement, and a
 * comparison that is too loose reports none either.
 *
 * So the reader is ground-truthed against the real design system rather than a
 * fixture, and every block asserts both directions on the same run.
 */

const repo = resolve(__dirname, '../../..');
const css = [
  "@import 'tailwindcss';",
  readFileSync(resolve(repo, 'packages/blocks/src/lib/style/foundation.css'), 'utf-8'),
  readFileSync(resolve(repo, 'packages/blocks/src/lib/style/semantic.css'), 'utf-8'),
  readFileSync(resolve(repo, 'packages/table/src/lib/style/table-theme.css'), 'utf-8')
].join('\n');

let design: CandidateAstSource & ClassCatalogueSource;
beforeAll(async () => {
  design = (await __unstable__loadDesignSystem(css, { base: repo })) as CandidateAstSource &
    ClassCatalogueSource;
});
const effectsOf = (classes: string[]) => collectClassEffects(design, classes);

describe('collectClassEffects', () => {
  it('reads the properties of plain, nested and at-rule-wrapped utilities', () => {
    const effects = effectsOf([
      'bg-primary',
      'text-sm',
      'hover:bg-primary',
      'md:flex',
      '2xl:px-4',
      'focus-visible:ring-2'
    ]);
    expect(effects.get('bg-primary')).toEqual(['background-color']);
    expect(effects.get('text-sm')).toEqual(['font-size', 'line-height']);
    // `hover:`, `md:` and `2xl:` arrive wrapped in @media; `focus-visible:` does not.
    expect(effects.get('hover:bg-primary')).toEqual(['background-color']);
    expect(effects.get('md:flex')).toEqual(['display']);
    expect(effects.get('2xl:px-4')).toEqual(['padding-inline']);
    expect(effects.get('focus-visible:ring-2')).toEqual(['--tw-ring-shadow', 'box-shadow']);
  });

  it('skips the @property registrations Tailwind emits beside a utility', () => {
    // Tailwind ships `@property --tw-scale-x { syntax; inherits; initial-value }`
    // beside the rule, and hangs each registration on whichever utility it
    // happened to emit first. So walking into them does not shift a family
    // evenly — it makes two members of ONE bucket differ by an emission
    // accident. Measured: every `scale-*` step keeps agreeing (they all carry
    // the registration), while `snap-x`/`snap-y`/`snap-both` carry it and
    // `snap-none` does not, inventing a `scroll-snap-type` collision out of
    // nothing; the `scale` exemption's pinned signatures also stop matching and
    // report stale.
    expect(effectsOf(['scale-150']).get('scale-150')).toEqual([
      '--tw-scale-x',
      '--tw-scale-y',
      '--tw-scale-z',
      'scale'
    ]);
    // The distinction the `scale-z` bucket rests on: both write `scale`, and
    // only the variables say one covers a third of what the other does.
    expect(effectsOf(['scale-z-150']).get('scale-z-150')).toEqual(['--tw-scale-z', 'scale']);
  });

  it('is unmoved by class shapes that have no readable CSS text', () => {
    // Both of these broke an earlier reader that attributed compiled CSS back to
    // classes by selector. `content-['*']` compiles to a selector holding
    // escaped quotes, which read as a string desynced that scanner for the rest
    // of the stylesheet; the `url()` carries a raw `;` and a `:` that invented a
    // second property. Per-candidate ASTs have no selector text to parse.
    const effects = effectsOf([
      "after:content-['*']",
      "before:content-['']",
      'bg-[url(x.svg?a=1;phantom:none)]',
      '[-ms-overflow-style:none]',
      'hover:bg-primary'
    ]);
    expect(effects.get("after:content-['*']")).toEqual(['--tw-content', 'content']);
    expect(effects.get('bg-[url(x.svg?a=1;phantom:none)]')).toEqual(['background-image']);
    expect(effects.get('[-ms-overflow-style:none]')).toEqual(['-ms-overflow-style']);
    expect(effects.get('hover:bg-primary')).toEqual(['background-color']);
  });

  it('reads a class whose rule is wrapped in a functional pseudo', () => {
    // `space-x-*` compiles to `:where(.-space-x-4 > :not(:last-child))`, so the
    // selector does not start with the class at all.
    expect(effectsOf(['-space-x-4']).get('-space-x-4')).toEqual([
      '--tw-space-x-reverse',
      'margin-inline-end',
      'margin-inline-start'
    ]);
  });

  it('omits a class Tailwind emits no rule for', () => {
    const effects = effectsOf(['bg-primary', 'bg-not-a-token', 'group']);
    expect(effects.has('bg-primary')).toBe(true);
    expect(effects.has('bg-not-a-token')).toBe(false);
    // A marker emits nothing, which is why the deliberate pass-through classes
    // need no allowlist: they never reach the comparison at all.
    expect(effects.has('group')).toBe(false);
  });
});

describe('findUnbucketed / findCollisions against the shipped table', () => {
  it('reports a class the table buckets as null, and clears one it buckets', () => {
    // `ordinal` is a real utility left without a bucket by design (it composes
    // into font-variant-numeric). Without it this test would pass against a
    // `findUnbucketed` that returned an empty list unconditionally.
    const unbucketed = findUnbucketed(effectsOf(['fill-primary', 'ordinal']), tailwindBucket);
    expect(unbucketed.map((u) => u.cls)).toEqual(['ordinal']);
    expect(unbucketed[0].properties).toEqual(['--tw-ordinal', 'font-variant-numeric']);
  });

  it('reports a bucket whose classes write different properties', () => {
    // The shape of the dba97fe8 bug: a size and a colour in one bucket.
    const effects = effectsOf(['text-primary', 'text-2xs']);
    const collisions = findCollisions(effects, (cls) =>
      // A table that reads every `text-*` as a colour — the pre-dba97fe8 state.
      cls.startsWith('text-') ? 'text-color' : tailwindBucket(cls)
    );
    expect(collisions).toHaveLength(1);
    expect(collisions[0].bucket).toBe('text-color');
    expect(collisions[0].effects.map((e) => e.properties)).toEqual(
      expect.arrayContaining([['color'], ['font-size']])
    );
  });

  it('stays quiet when every class in a bucket writes the same properties', () => {
    const effects = effectsOf(['bg-primary', 'bg-surface-base', 'hover:bg-primary']);
    expect(findCollisions(effects, tailwindBucket)).toEqual([]);
  });

  it('classifies a collision by how the property sets relate', () => {
    // The triage order the report prints. Disjoint sets cannot replace each
    // other, so the bucket always strips something for nothing; nesting is
    // what a composition looks like; overlap needs a human.
    const disjoint = findCollisions(effectsOf(['bg-primary', 'bg-blend-multiply']), (cls) =>
      cls.startsWith('bg-') ? 'bg-color' : null
    );
    expect(disjoint.map((c) => c.relation)).toEqual(['disjoint']);

    const nested = findCollisions(effectsOf(['truncate', 'text-ellipsis']), tailwindBucket);
    expect(nested.map((c) => c.relation)).toEqual(['nested']);

    const overlap = findCollisions(
      effectsOf(['break-all', 'break-normal', 'break-words']),
      () =>
        // The pre-repair `word-break` bucket: `word-break`, `overflow-wrap` and
        // both together, which is neither disjoint nor nested.
        'word-break'
    );
    expect(overlap.map((c) => c.relation)).toEqual(['overlap']);
  });
});

describe('catalogueClasses', () => {
  it('names the enumerable classes and no arbitrary or variant-prefixed form', () => {
    // Why both populations exist. The catalogue is the only place a bucket
    // over-reach outside the library's vocabulary can be seen; the shipped
    // classes are the only place these four can.
    const catalogue = new Set(catalogueClasses(design));
    expect(catalogue.size).toBeGreaterThan(10_000);
    expect(catalogue.has('stroke-2')).toBe(true);
    expect(catalogue.has('border-be-2')).toBe(true);
    for (const shippedOnly of ['stroke-[2px]', 'scale-[1.01]', 'active:scale-95', 'break-words']) {
      expect(catalogue.has(shippedOnly)).toBe(false);
    }
  });

  it('every catalogue canary is readable, and a truncated catalogue loses them all', () => {
    // The gate's own guard, asserted here rather than only in the run. Each
    // canary is a class the library never writes, so it can only arrive from
    // getClassList — which is what makes it a canary on that half.
    const catalogue = catalogueClasses(design);
    const effects = collectClassEffects(design, catalogue);
    expect(CATALOGUE_CANARIES.filter((cls) => !effects.has(cls))).toEqual([]);

    // Positive control on the guard, not just on the reader: a size floor was
    // the first shape here and it is green for a reader that keeps a plausible
    // fraction. Truncated to 500 of 35 140, every canary is gone.
    const truncated = collectClassEffects(design, catalogue.slice(0, 500));
    expect(truncated.size).toBeGreaterThan(0);
    expect(CATALOGUE_CANARIES.filter((cls) => truncated.has(cls))).toEqual([]);
  });
});
