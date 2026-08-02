import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findNonEmittingClasses } from './tailwind-emit';

/**
 * The emitted-CSS guard, against the real Tailwind 4 compiler — there is no
 * model here to unit-test, so these tests are the ground-truthing.
 *
 * They exist because the guard's failure mode is silence: a compile that
 * returns nothing, or a selector match that is too loose, makes every class
 * look fine. Each block below therefore asserts BOTH directions on the same
 * run — the typo is reported AND the legitimate neighbour is not.
 */

const repo = resolve(__dirname, '../../..');
const style = (p: string) =>
  readFileSync(resolve(repo, 'packages/blocks/src/lib/style', p), 'utf-8');

const css = [
  "@import 'tailwindcss';",
  style('foundation.css'),
  style('semantic.css'),
  readFileSync(resolve(repo, 'packages/table/src/lib/style/table-theme.css'), 'utf-8')
].join('\n');

const deadOf = async (classes: string[]) =>
  new Set((await findNonEmittingClasses(classes, { css, base: repo })).dead);

describe('findNonEmittingClasses — the colour-capable namespaces (#61)', () => {
  it('reports a mistyped key in every colour-capable namespace, and clears the real one', async () => {
    // `bg-` is the one the issue was filed about — five of the library's
    // on-colour references live there (RadioGroup's checked dot). The other
    // nine were listed in the issue as "worth deciding at the same time"; the
    // compiler decides all ten without a statics list to maintain.
    const pairs = [
      ['bg-text-on-fill', 'bg-text-on-fillx'],
      ['border-border-subtle', 'border-border-subtlex'],
      ['ring-primary', 'ring-primaryx'],
      ['outline-primary', 'outline-primaryx'],
      ['divide-border-subtle', 'divide-border-subtlex'],
      ['fill-primary', 'fill-primaryx'],
      ['stroke-primary', 'stroke-primaryx'],
      ['accent-primary', 'accent-primaryx'],
      ['caret-primary', 'caret-primaryx'],
      ['decoration-primary', 'decoration-primaryx']
    ];
    const dead = await deadOf(pairs.flat());

    for (const [real, typo] of pairs) {
      expect(dead, `${typo} must be reported`).toContain(typo);
      expect(dead, `${real} must not be`).not.toContain(real);
    }
  });

  it('does not flag the static utilities that share the bg- prefix', async () => {
    // The reason `bg-` was deferred: it is the widest namespace and its
    // statics list is large and genuinely mixed. Nothing here is enumerated
    // by the guard — the compiler simply emits rules for them.
    const dead = await deadOf([
      'bg-cover',
      'bg-center',
      'bg-no-repeat',
      'bg-clip-text',
      'bg-origin-border',
      'bg-blend-multiply',
      'bg-linear-to-r',
      'bg-gradient-to-r',
      'bg-radial',
      'bg-conic',
      'bg-fixed',
      'bg-local',
      'bg-scroll',
      'bg-auto',
      'bg-contain',
      'bg-bottom',
      'bg-repeat-x',
      'bg-none'
    ]);
    expect([...dead]).toEqual([]);
  });

  it('sees through variant prefixes', async () => {
    const dead = await deadOf(['hover:bg-primary', 'hover:bg-primaryx', 'md:focus:bg-primaryx']);
    expect(dead).toEqual(new Set(['hover:bg-primaryx', 'md:focus:bg-primaryx']));
  });

  it('leaves arbitrary values and modifiers alone', async () => {
    const dead = await deadOf([
      'z-[var(--z-tooltip)]',
      'bg-primary/70',
      'text-sm/6',
      'duration-[var(--blocks-duration-fast)]',
      '[color:inherit]'
    ]);
    expect([...dead]).toEqual([]);
  });

  it('does not let a longer class vouch for a dead shorter one', async () => {
    // The selector match must end at the class name. `.text-sm\/6` in the
    // output must not make a dead `text-smx` look alive, and a real prefix
    // relationship (`bg-primary` vs `bg-primary-subtle`) must not either.
    const dead = await deadOf(['text-sm/6', 'text-smx', 'bg-primary-subtle', 'bg-primaryx']);
    expect(dead).toEqual(new Set(['text-smx', 'bg-primaryx']));
  });

  it('treats named group/peer labels as emitting nothing by design', async () => {
    // These are labels for `group-hover/name:` to target; Tailwind writes no
    // rule of its own for them. Handled by kind, so a component that gains a
    // named group needs no edit to the lint.
    const dead = await deadOf(['group/cell', 'peer/input', 'group', 'peer']);
    expect([...dead]).toEqual([]);
  });

  it('reports the two real bugs its first run found', async () => {
    // Regression anchors, both measured against this compiler on 2026-08-02.
    const dead = await deadOf([
      'resize-vertical', // not a Tailwind utility — `resize-y` is
      'resize-y',
      'from-surface-2', // `surface-2`/`surface-3` are not tokens here
      'via-surface-3',
      'from-surface-interactive',
      'via-skeleton-shimmer'
    ]);
    expect(dead).toEqual(new Set(['resize-vertical', 'from-surface-2', 'via-surface-3']));
  });

  it('counts what it compiled, so a caller can tell an empty run from a clean one', async () => {
    const probe = await findNonEmittingClasses(['bg-primary', 'bg-primary', 'text-sm'], {
      css,
      base: repo
    });
    expect(probe.checked).toBe(2);
    expect(probe.dead).toEqual([]);
  });
});
