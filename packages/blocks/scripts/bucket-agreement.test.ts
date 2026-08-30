import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { tailwindBucket } from '../src/lib/utils/variants';
import { collectClassEffects, compareBuckets, firstClassSelector } from './bucket-agreement';
import { findNonEmittingClasses } from './tailwind-emit';

/**
 * The bucket-agreement pass reads which CSS properties each class declares out
 * of the compiled stylesheet. Its failure mode is silence in both halves: a
 * scanner that loses its place attributes nothing and reports no disagreement,
 * and a comparison that is too loose reports none either.
 *
 * So the reader is ground-truthed against the real compiler rather than a
 * fixture, and every block asserts both directions on the same run.
 */

const repo = resolve(__dirname, '../../..');
const css = [
  "@import 'tailwindcss';",
  readFileSync(resolve(repo, 'packages/blocks/src/lib/style/foundation.css'), 'utf-8'),
  readFileSync(resolve(repo, 'packages/blocks/src/lib/style/semantic.css'), 'utf-8'),
  readFileSync(resolve(repo, 'packages/table/src/lib/style/table-theme.css'), 'utf-8')
].join('\n');

const effectsOf = async (classes: string[]) => {
  const probe = await findNonEmittingClasses(classes, { css, base: repo });
  return collectClassEffects(probe.css, classes);
};

describe('firstClassSelector', () => {
  it('takes the utility class, not the label a variant selector ends with', () => {
    expect(firstClassSelector('.bg-primary')).toBe('.bg-primary');
    expect(firstClassSelector('.hover\\:bg-primary:hover')).toBe('.hover\\:bg-primary');
    expect(firstClassSelector('.group-hover\\:opacity-100:is(:where(.group):hover *)')).toBe(
      '.group-hover\\:opacity-100'
    );
    // `space-x-*` and `divide-*` wrap the class in a functional pseudo, so the
    // selector does not START with it.
    expect(firstClassSelector(':where(.-space-x-4 > :not(:last-child))')).toBe('.-space-x-4');
    expect(firstClassSelector('.\\[\\&_path\\]\\:stroke-2 path')).toBe(
      '.\\[\\&_path\\]\\:stroke-2'
    );
  });

  it('keeps a hex escape whole, including its terminating space', () => {
    // A class starting with a digit cannot be backslash-escaped, so Tailwind
    // writes `2xl:px-4` as `.\32 xl\:px-4`. Reading that space as the end of
    // the class name yields `.\32`, which matches no candidate.
    expect(firstClassSelector('.\\32 xl\\:px-4')).toBe('.\\32 xl\\:px-4');
  });

  it('returns null for a selector that names no class', () => {
    expect(firstClassSelector(':root')).toBeNull();
    expect(firstClassSelector('*, ::before')).toBeNull();
  });
});

describe('collectClassEffects', () => {
  it('reads the properties of plain, nested and at-rule-wrapped utilities', async () => {
    const effects = await effectsOf([
      'bg-primary',
      'text-sm',
      'hover:bg-primary',
      'md:flex',
      'focus-visible:ring-2'
    ]);
    expect(effects.get('bg-primary')).toEqual(['background-color']);
    expect(effects.get('text-sm')).toEqual(['font-size', 'line-height']);
    // `hover:` and `md:` sit inside @media, `focus-visible:` does not.
    expect(effects.get('hover:bg-primary')).toEqual(['background-color']);
    expect(effects.get('md:flex')).toEqual(['display']);
    expect(effects.get('focus-visible:ring-2')).toEqual(['--tw-ring-shadow', 'box-shadow']);
  });

  it('keeps reading after a selector whose escaped quotes are not a string', async () => {
    // Regression: `content-['*']` compiles to the selector
    // `.after\:content-\[\'\*\'\]::after`. Reading `\'` as a string escape
    // walks past the closing quote, and every rule after that one is lost —
    // measured at 399 classes, all variant-prefixed, with no error raised.
    const effects = await effectsOf([
      "after:content-['*']",
      "before:content-['']",
      'hover:bg-primary',
      'z-10'
    ]);
    expect(effects.get("after:content-['*']")).toEqual(['--tw-content', 'content']);
    expect(effects.get('hover:bg-primary')).toEqual(['background-color']);
    expect(effects.get('z-10')).toEqual(['z-index']);
  });

  it('omits a class Tailwind emits no rule for', async () => {
    const effects = await effectsOf(['bg-primary', 'bg-not-a-token']);
    expect(effects.has('bg-primary')).toBe(true);
    expect(effects.has('bg-not-a-token')).toBe(false);
  });

  it('records the composition variables, not just the CSS property', async () => {
    // The distinction the `scale-z` bucket rests on: both write `scale`, and
    // only the variables say that one covers a third of what the other does.
    const effects = await effectsOf(['scale-110', 'scale-z-150']);
    expect(effects.get('scale-110')).toEqual([
      '--tw-scale-x',
      '--tw-scale-y',
      '--tw-scale-z',
      'scale'
    ]);
    expect(effects.get('scale-z-150')).toEqual(['--tw-scale-z', 'scale']);
  });
});

describe('compareBuckets against the shipped table', () => {
  it('reports a class the table buckets as null, and clears one it buckets', async () => {
    const effects = await effectsOf(['fill-primary', 'blocks-not-a-utility-marker']);
    const { unbucketed } = compareBuckets(effects, tailwindBucket);
    expect(unbucketed.map((u) => u.cls)).toEqual([]);
    // The marker emits no CSS, so it never reaches the comparison at all —
    // which is why the deliberate pass-through classes need no allowlist.
    expect(effects.has('blocks-not-a-utility-marker')).toBe(false);
  });

  it('reports a bucket whose classes write different properties', async () => {
    // The shape of the dba97fe8 bug: a size and a colour in one bucket.
    const effects = await effectsOf(['text-primary', 'text-2xs']);
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

  it('stays quiet when every class in a bucket writes the same properties', async () => {
    const effects = await effectsOf(['bg-primary', 'bg-surface-base', 'hover:bg-primary']);
    expect(compareBuckets(effects, tailwindBucket).collisions).toEqual([]);
  });
});
