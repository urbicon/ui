import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkboxVariants } from '../primitives/Checkbox/checkbox.variants';
import { radioItemVariants } from '../primitives/RadioGroup/radioGroup.variants';

/**
 * Squaring the pill must not square the radio.
 *
 * `--radius-commit` used to drive both the pill of a commit-tier button and the
 * circle of a radio indicator, and `foundation.css` explicitly invites a theme
 * to zero it. Taking that invitation turned every radio into something that
 * reads as a checkbox — shape is the only thing carrying "pick exactly one",
 * since both controls are otherwise the same small box with the same label.
 *
 * It was not a corner case for austere themes. **All four** docs liveries needed
 * a `CIRCULAR_RADIOS` provider override, including the one that merely softens
 * the tier to 2px — 2px on a 20px control already reads as square.
 *
 * The checkbox deliberately keeps riding the tier: a pill-shaped checkbox is
 * what a consumer asked for by writing `tier="commit"`, not damage inflicted by
 * a theme aiming at buttons. Asserted below so the "mirror case" reading cannot
 * come back — giving the checkbox its own token made the tier a no-op there,
 * since the natural value is what `modify` already resolves to.
 */

const foundation = readFileSync(resolve(import.meta.dirname, './foundation.css'), 'utf8');

/**
 * A custom property's raw value, or null when undeclared.
 *
 * Comments are stripped first. These files carry long prose blocks that discuss
 * the tokens by name, and a sentence containing `--radius-commit: 0` parses as a
 * declaration otherwise — the exact trap that broke `figma-token-export.test.ts`
 * on 2026-07-31, reproduced here by writing the comment that broke it.
 */
function decl(name: string): string | null {
  const withoutComments = foundation.replace(/\/\*[\s\S]*?\*\//g, '');
  return new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(withoutComments)?.[1].trim() ?? null;
}

describe('the radio indicator owns its shape', () => {
  it('declares --radius-control independently of the tier', () => {
    // Not `var(--radius-commit)`, or zeroing the pill drags it along again and
    // the whole split is decorative.
    expect(decl('--radius-control')).toBe('9999px');
    expect(decl('--radius-control')).not.toContain('--radius-commit');
  });

  it('leaves the commit tier itself a pill', () => {
    expect(decl('--radius-commit')).toBe('9999px');
  });

  // These call the variant functions rather than grepping their source. The
  // first version of this file searched the .ts text for `rounded-control`,
  // which a comment satisfies: replacing the real value with `rounded-none` left
  // all six cases green while every radio rendered square. Measured, not
  // assumed.
  it('gives the radio indicator and dot the control radius on the commit tier', () => {
    // `commit` is RadioItem's default and the only tier that produced the
    // circle. `modify` deliberately squares the control off (`rounded-modify`),
    // which is a shape the consumer asked for — the same distinction the
    // checkbox case below rests on.
    const styles = radioItemVariants({ tier: 'commit', checked: true });
    expect(styles.indicator()).toContain('rounded-control');
    expect(styles.dot()).toContain('rounded-control');
  });

  it('never lets a commit-tier radius reach the radio', () => {
    const styles = radioItemVariants({ tier: 'commit', checked: true });
    expect(styles.indicator().split(/\s+/)).not.toContain('rounded-commit');
    expect(styles.dot().split(/\s+/)).not.toContain('rounded-commit');
  });

  it('keeps the checkbox on the tier — its pill is requested, not inflicted', () => {
    // `tier="commit"` on a checkbox is the documented status-chip look. If this
    // ever resolves to the same radius as `modify`, the tier has silently become
    // a no-op for the component and the prop does nothing.
    const commit = checkboxVariants({ tier: 'commit' }).box();
    const modify = checkboxVariants({ tier: 'modify' }).box();
    expect(commit.split(/\s+/)).toContain('rounded-commit');
    expect(commit, 'the two tiers must render differently').not.toBe(modify);
  });
});
