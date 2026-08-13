import { describe, expect, it } from 'vitest';
import { badgeVariants } from '../primitives/Badge/badge.variants';
import { buttonVariants } from '../primitives/Button/button.variants';
import { checkboxVariants } from '../primitives/Checkbox/checkbox.variants';
import { radioItemVariants } from '../primitives/RadioGroup/radioGroup.variants';
import { toggleVariants } from '../primitives/Toggle/toggle.variants';

/**
 * A filled intent surface carries its state in the fill, never in a border
 * repeating that fill.
 *
 * Five components paint a surface in `bg-<intent>` and step it through the
 * interaction layer (`hover:bg-<intent>-hover`, `active:bg-<intent>-active`,
 * or their `group-*` twins). Where such a surface also drew `border-<intent>`,
 * the border sat on the RESTING stop while the fill moved off it — leaving a
 * ring in the old tone around a darkened surface. It reads as a light halo on
 * light pages and inverts in dark mode, where the fill lightens past a border
 * that stays put.
 *
 * WHY THIS LIVES HERE AND NOT IN FIVE COMPONENT TESTS. The first version of
 * this rule was a matrix loop inside `button.variants.test.ts`. It was green
 * and it was worthless: it could only see Button, and once Button went
 * `border-transparent` its own filter skipped every filled cell — 12 of 96
 * iterations reached an assertion, all of them the `outlined` family a
 * neighbouring test already covered. Toggle carried the same defect on all 12
 * of its checked stops and Badge on 6, and no test could have noticed, because
 * no test looked across components. The rule is a property of the token
 * vocabulary, so it belongs next to the vocabulary.
 *
 * A border is allowed to stay put when it is a BOUNDARY rather than a copy:
 * `border-<intent>-active` on a connected ButtonGroup separates two buttons,
 * and an `outlined` button's border IS the variant. Both are off the resting
 * stop or move with the fill, so the check below passes them without needing
 * an exception list.
 */

const INTENTS = ['primary', 'secondary', 'success', 'warning', 'danger', 'neutral'] as const;

/**
 * The resting stop, matched with word boundaries.
 *
 * `border-primary` is a prefix of `border-primary-active`, so `includes()`
 * cannot tell the resting stop from the interaction stops — and mistaking one
 * for the other would flag the ButtonGroup divider as the very bug it exists
 * to avoid.
 */
const restingBorder = (classes: string, intent: string) =>
  new RegExp(`(^| )border-${intent}( |$)`).test(classes);

/** `hover:` and `group-hover:` are one rule; a component picks by whether the label counts. */
const fillLadder = (classes: string, intent: string) =>
  new RegExp(`(^| )(group-)?hover:bg-${intent}-hover( |$)`).test(classes);

const borderLadder = (classes: string, intent: string) =>
  new RegExp(`(^| )(group-)?hover:border-${intent}-hover( |$)`).test(classes);

/** Null when the class list is fine, else what is wrong with it. */
function halo(classes: string, intent: string): string | null {
  if (!fillLadder(classes, intent)) return null;
  if (!restingBorder(classes, intent)) return null;
  if (borderLadder(classes, intent)) return null;
  return `border-${intent} rests while the fill steps to ${intent}-hover`;
}

/**
 * Every axis combination of one slot, as class lists.
 *
 * Axes that cannot reach a colour bucket (size, tier, placement, …) are pinned
 * to one value instead of multiplied out: they change geometry, and carrying
 * them would put this test into the hundreds of thousands of tv() calls for
 * cells that differ only in `h-8` vs `h-10`. The axes listed per surface are
 * the ones that select or restate a fill.
 */
function sweep(
  variants: (props: Record<string, unknown>) => Record<string, () => string>,
  slot: string,
  axes: Record<string, readonly unknown[]>
): Array<{ props: Record<string, unknown>; classes: string }> {
  const names = Object.keys(axes);
  const out: Array<{ props: Record<string, unknown>; classes: string }> = [];
  const walk = (i: number, props: Record<string, unknown>) => {
    if (i === names.length) {
      out.push({ props: { ...props }, classes: variants(props)[slot]() });
      return;
    }
    for (const value of axes[names[i]]) walk(i + 1, { ...props, [names[i]]: value });
  };
  walk(0, {});
  return out;
}

const BOOL = [true, false] as const;

const SURFACES = [
  {
    name: 'Button',
    run: () =>
      sweep(buttonVariants as never, 'base', {
        intent: INTENTS,
        variant: ['filled', 'outlined', 'ghost', 'text'],
        active: BOOL,
        pressed: BOOL,
        buttonGroupConnected: BOOL
      })
  },
  {
    name: 'Checkbox',
    run: () =>
      sweep(checkboxVariants as never, 'box', {
        intent: INTENTS,
        variant: ['outlined', 'filled', 'ghost'],
        checked: BOOL,
        indeterminate: BOOL,
        error: BOOL
      })
  },
  {
    name: 'RadioGroup',
    run: () =>
      sweep(radioItemVariants as never, 'indicator', {
        intent: INTENTS,
        variant: ['outlined', 'filled', 'ghost'],
        checked: BOOL,
        error: BOOL
      })
  },
  {
    name: 'Toggle',
    run: () =>
      sweep(toggleVariants as never, 'track', {
        intent: INTENTS,
        variant: ['default', 'dot'],
        checked: BOOL,
        error: BOOL
      })
  },
  {
    name: 'Badge',
    run: () =>
      sweep(badgeVariants as never, 'base', {
        intent: INTENTS,
        variant: ['filled', 'outlined', 'soft', 'dot'],
        interactive: BOOL
      })
  }
] as const;

describe('a filled intent surface carries its state in the fill', () => {
  // The control on the oracle itself, not on the config. Both filters below
  // are `return null` paths, so a rule that stops matching anything reports
  // "no violations" just as loudly as a config that has none — which is how
  // the loop this replaces stayed green while covering nothing.
  it('recognises the halo, and each of the three ways out of it', () => {
    expect(halo('bg-primary border-primary hover:bg-primary-hover', 'primary')).not.toBeNull();
    expect(
      halo('bg-primary border-primary group-hover:bg-primary-hover', 'primary'),
      'the group-* twin is the same rule'
    ).not.toBeNull();

    // 1. no border colour of its own (what the filled surfaces do)
    expect(halo('bg-primary border-transparent hover:bg-primary-hover', 'primary')).toBeNull();
    // 2. the border moves along (what an active outlined button does)
    expect(
      halo(
        'bg-primary border-primary hover:bg-primary-hover hover:border-primary-hover',
        'primary'
      ),
      'a border that follows the fill is not left behind'
    ).toBeNull();
    // 3. the border is not on the resting stop (the ButtonGroup divider)
    expect(
      halo('bg-primary border-primary-active hover:bg-primary-hover', 'primary'),
      'a boundary between two surfaces is not a copy of one fill'
    ).toBeNull();

    // And it must not fire on a surface with no ladder at all.
    expect(halo('bg-primary border-primary', 'primary')).toBeNull();
  });

  for (const surface of SURFACES) {
    it(`holds across every ${surface.name} combination`, () => {
      const cells = surface.run();
      const withLadder = cells.filter(({ classes }) =>
        INTENTS.some((intent) => fillLadder(classes, intent))
      );

      // Positive control on the sweep: a surface that reaches zero ladder
      // cells is not passing, it is not looking. Every component here has at
      // least the six intents × the states that fill them.
      expect(
        withLadder.length,
        `${surface.name} produced no interactive fill at all`
      ).toBeGreaterThan(5);

      const violations = cells.flatMap(({ props, classes }) =>
        INTENTS.map((intent) => halo(classes, intent))
          .filter((v): v is string => v !== null)
          .map((v) => `${JSON.stringify(props)}: ${v}`)
      );
      expect(violations).toEqual([]);
    });
  }
});
