import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { __unstable__loadDesignSystem } from '@tailwindcss/node';
import { beforeAll, describe, expect, it } from 'vitest';
import { tailwindBucket } from '../src/lib/utils/variants';
import { type CandidateAstSource, collectClassEffects, compareBuckets } from './bucket-agreement';

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

let design: CandidateAstSource;
beforeAll(async () => {
  design = (await __unstable__loadDesignSystem(css, { base: repo })) as CandidateAstSource;
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
    // `scale-*` ships `@property --tw-scale-x { syntax; inherits; initial-value }`
    // next to the rule. Walking into it would credit the class with three
    // properties it does not write, and every scale utility would then disagree
    // with every other one.
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

describe('compareBuckets against the shipped table', () => {
  it('reports a class the table buckets as null, and clears one it buckets', () => {
    // `ordinal` is a real utility left without a bucket by design (it composes
    // into font-variant-numeric). Without it this test would pass against a
    // `compareBuckets` that returned an empty list unconditionally.
    const { unbucketed } = compareBuckets(effectsOf(['fill-primary', 'ordinal']), tailwindBucket);
    expect(unbucketed.map((u) => u.cls)).toEqual(['ordinal']);
    expect(unbucketed[0].properties).toEqual(['--tw-ordinal', 'font-variant-numeric']);
  });

  it('reports a bucket whose classes write different properties', () => {
    // The shape of the dba97fe8 bug: a size and a colour in one bucket.
    const effects = effectsOf(['text-primary', 'text-2xs']);
    const { collisions } = compareBuckets(effects, (cls) =>
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
    expect(compareBuckets(effects, tailwindBucket).collisions).toEqual([]);
  });
});
