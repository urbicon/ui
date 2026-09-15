import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { linkVariants } from './link.variants';

const VARIANTS = ['inline', 'standalone'] as const;

const SEMANTIC_CSS = readFileSync(resolve(import.meta.dirname, '../../style/semantic.css'), 'utf8');

/** The two arguments of a text token's `light-dark(…)` declaration, in order. */
function inkStops(token: string): [string, string] {
  const match = SEMANTIC_CSS.match(
    new RegExp(`--color-text-${token}:\\s*light-dark\\(([^,]+),\\s*([^)]+)\\)`)
  );
  if (!match) throw new Error(`--color-text-${token} is not a light-dark() declaration`);
  return [match[1].trim(), match[2].trim()];
}

describe('linkVariants', () => {
  it('paints a prose link in link ink and underlines it', () => {
    const base = linkVariants({ variant: 'inline' }).base();
    // `--color-text-link` is the documented lever for restyling links without
    // touching the primary intent (style/semantic.css); the underline is the
    // second cue, so colour is never the only one (WCAG 1.4.1).
    expect(base).toContain('text-text-link');
    expect(base).toContain('underline');
    expect(base).not.toContain('no-underline');
    expect(base).toContain('underline-offset-4');
    expect(base).toContain('decoration-text-quaternary');
    expect(base).toContain('hover:decoration-text-primary');
  });

  it('never repaints a prose link on hover — only its underline moves', () => {
    const base = linkVariants({ variant: 'inline' }).base();
    expect(base).not.toMatch(/hover:text-/);
  });

  it('draws a standalone handle without an underline, tertiary until hover', () => {
    const base = linkVariants({ variant: 'standalone' }).base();
    expect(base).toContain('no-underline');
    expect(base).toContain('text-text-tertiary');
    expect(base).not.toContain('underline-offset-4');
  });

  it('hovers a handle to a colour that differs from its rest in BOTH modes', () => {
    const base = linkVariants({ variant: 'standalone' }).base();
    expect(base).toContain('hover:text-text-primary');

    // The reason it is `primary` and not `secondary`: `--color-text-secondary`
    // and `--color-text-tertiary` share their dark-mode stop, so that hover
    // would paint nothing at all for a dark-mode reader. Asked of the
    // stylesheet, so a palette change moves this answer.
    const [restLight, restDark] = inkStops('tertiary');
    const [hoverLight, hoverDark] = inkStops('primary');
    expect(hoverLight).not.toBe(restLight);
    expect(hoverDark).not.toBe(restDark);
    expect(inkStops('secondary')[1]).toBe(restDark);
  });

  it('lifts the active link to ink and medium weight', () => {
    const base = linkVariants({ variant: 'standalone', active: true }).base();
    expect(base).toContain('text-text-primary');
    expect(base).toContain('font-medium');
    expect(base).not.toContain('text-text-tertiary');
  });

  it('gives the active link no hover state at all — you are already on it', () => {
    for (const variant of VARIANTS) {
      expect(linkVariants({ variant, active: true }).base()).not.toMatch(/\bhover:/);
    }
  });

  it('makes a disabled link look inert', () => {
    const base = linkVariants({ disabled: true }).base();
    expect(base).toContain('opacity-50');
    expect(base).toContain('cursor-not-allowed');
    expect(base).toContain('pointer-events-none');
  });

  it('draws the focus ring as an outline in the focus-ring token, keyboard-only', () => {
    const base = linkVariants().base();
    expect(base).toContain('focus-visible:outline-solid');
    expect(base).toContain('focus-visible:outline-(color:--blocks-focus-ring-color)');
    expect(base).toContain('rounded-modify');
    expect(base).not.toMatch(/(^|\s)focus:/);
  });

  it('defaults to the inline voice', () => {
    expect(linkVariants().base()).toBe(linkVariants({ variant: 'inline' }).base());
  });

  it("lets a consumer's own class beat the variant's colour", () => {
    // What the tab-navigation pattern rests on: its active tab paints
    // `text-primary-text` through `class` while the active axis writes
    // `text-text-primary` into the same bucket. An unprefixed class strips only
    // the unprefixed bucket, which is why the active link carries no `hover:`
    // colour for it to leave behind.
    const base = linkVariants({ variant: 'standalone', active: true }).base({
      class: 'text-primary-text'
    });
    expect(base).toContain('text-primary-text');
    expect(base).not.toContain('text-text-primary');
    expect(base).toContain('font-medium');
  });

  it('never outputs dark: overrides', () => {
    for (const variant of VARIANTS) {
      for (const active of [false, true]) {
        for (const disabled of [false, true]) {
          expect(linkVariants({ variant, active, disabled }).base()).not.toMatch(/\bdark:/);
        }
      }
    }
  });
});
