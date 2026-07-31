import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Squaring the pill must not square the radio.
 *
 * `--radius-commit` used to drive both the pill of a commit-tier button and the
 * circle of a radio indicator, and `foundation.css` explicitly invites a theme
 * to zero it ("a more austere one can drop r-modify to 0"). Taking that
 * invitation turned every radio into something that reads as a checkbox — shape
 * is the only thing carrying "pick exactly one", since both controls are
 * otherwise the same small box with the same label.
 *
 * It was not a corner case for austere themes. **All four** docs liveries needed
 * a `CIRCULAR_RADIOS` provider override, including the one that merely softens
 * the tier to 2px — 2px on a 20px control already reads as square. Any theme
 * that touched the tier at all lost the affordance.
 *
 * These assertions are deliberately about the *token graph* rather than about
 * rendered pixels: the failure is that two roles share one variable, and that is
 * visible in the declarations. A screenshot of the default theme shows nothing,
 * because the defaults are identical — which is exactly what made this survive.
 */

const STYLE_DIR = import.meta.dirname;
const foundation = readFileSync(resolve(STYLE_DIR, './foundation.css'), 'utf8');
const radioVariants = readFileSync(
  resolve(STYLE_DIR, '../primitives/RadioGroup/radioGroup.variants.ts'),
  'utf8'
);
const checkboxVariants = readFileSync(
  resolve(STYLE_DIR, '../primitives/Checkbox/checkbox.variants.ts'),
  'utf8'
);

/** A custom property's raw value, or null when it is not declared. */
function decl(css: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*:\\s*([^;]+);`);
  return re.exec(css)?.[1].trim() ?? null;
}

describe('the selection controls own their shape', () => {
  it('declares a token for each control', () => {
    expect(decl(foundation, '--radius-control'), '--radius-control missing').not.toBeNull();
    expect(decl(foundation, '--radius-checkbox'), '--radius-checkbox missing').not.toBeNull();
  });

  it('keeps them independent of the commit tier', () => {
    // The whole point: neither may be `var(--radius-commit)`, or zeroing the
    // pill drags them along again and the split is decorative.
    expect(decl(foundation, '--radius-control')).not.toContain('--radius-commit');
    expect(decl(foundation, '--radius-checkbox')).not.toContain('--radius-commit');
  });

  it('keeps the radio fully round and the checkbox not', () => {
    // Convention with meaning, not taste: Material, HIG and Carbon all hold it.
    expect(decl(foundation, '--radius-control')).toBe('9999px');
    expect(decl(foundation, '--radius-checkbox')).not.toBe('9999px');
  });

  it('wires the radio indicator and dot to the control token', () => {
    expect(radioVariants).toContain("indicator: 'rounded-control'");
    expect(radioVariants).toContain("dot: 'rounded-control'");
    // No commit-tier radius may survive on the indicator — that is the
    // regression this file exists for.
    expect(radioVariants).not.toMatch(/indicator: 'rounded-commit'/);
    expect(radioVariants).not.toMatch(/dot: 'rounded-commit'/);
  });

  it('wires the checkbox box to the checkbox token', () => {
    expect(checkboxVariants).toContain("box: 'rounded-checkbox'");
    expect(checkboxVariants).not.toMatch(/commit: \{ box: 'rounded-commit' \}/);
  });

  it('leaves the commit tier itself a pill', () => {
    // The controls moved out; the tier did not change. A button is still a pill.
    expect(decl(foundation, '--radius-commit')).toBe('9999px');
  });
});
