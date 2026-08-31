import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { baseDeclarations } from './css-declarations';
import { parseInteractionTokens } from './interaction-tokens';

const __dirname = dirname(fileURLToPath(import.meta.url));
const interactionCss = readFileSync(
  resolve(__dirname, '../../../../packages/blocks/src/lib/style/interaction.css'),
  'utf8'
);

describe('parseInteractionTokens against the shipped interaction.css', () => {
  const tokens = parseInteractionTokens(interactionCss);

  it('finds the full duration scale', () => {
    expect(tokens.durations.map((t) => t.name)).toEqual([
      '--blocks-duration-instant',
      '--blocks-duration-fast',
      '--blocks-duration-normal',
      '--blocks-duration-slow',
      '--blocks-duration-slower',
      '--blocks-duration-slowest'
    ]);
    expect(tokens.durations.find((t) => t.name === '--blocks-duration-fast')?.value).toBe('150ms');
  });

  it('finds every easing, not just the one the prose names', () => {
    // The hand-written table shipped one easing as an aside while the file
    // defines seven.
    expect(tokens.easings.length).toBe(7);
    expect(tokens.easings.find((t) => t.name === '--blocks-ease-gentle')?.value).toBe(
      'cubic-bezier(0.25, 0.1, 0.25, 1)'
    );
  });

  it('finds the shadow tokens and keeps their var() source', () => {
    expect(tokens.shadows.map((t) => t.name)).toEqual([
      '--blocks-shadow-xs',
      '--blocks-shadow-sm',
      '--blocks-shadow-base',
      '--blocks-shadow-md',
      '--blocks-shadow-lg'
    ]);
    expect(tokens.shadows.every((t) => t.value.startsWith('var(--blocks-shadow-scale-'))).toBe(
      true
    );
  });

  it('finds the per-component aliases AND the focus-ring knobs', () => {
    const names = tokens.overridePoints.map((t) => t.name);
    for (const component of ['tooltip', 'popover', 'collapse']) {
      expect(names, component).toContain(`--blocks-${component}-duration`);
      expect(names, component).toContain(`--blocks-${component}-easing`);
    }
    expect(names).toContain('--blocks-focus-ring-width');
    expect(names).toContain('--blocks-focus-ring-offset');
    expect(names).toContain('--blocks-focus-ring-color');
  });

  it('finds the hyphenated overlay knobs too', () => {
    // The four the table listed the single-word aliases beside, and dropped.
    const names = tokens.overridePoints.map((t) => t.name);
    for (const knob of [
      '--blocks-overlay-enter-duration',
      '--blocks-overlay-exit-duration',
      '--blocks-overlay-backdrop-enter-duration',
      '--blocks-overlay-backdrop-exit-duration'
    ]) {
      expect(names, knob).toContain(knob);
    }
  });

  it('would not find them under a single-segment component pattern', () => {
    // Positive control on the fix: the old shape, run over the same file, has
    // to come back missing all four — otherwise the test above proves nothing.
    const old = /^--blocks-(?!duration-|ease-)[a-z]+-(duration|easing)$/;
    const matched = baseDeclarations([interactionCss])
      .map((r) => r.name)
      .filter((name) => old.test(name));
    expect(matched).not.toContain('--blocks-overlay-enter-duration');
    expect(matched).toContain('--blocks-tooltip-duration');
  });

  it('does not mistake the base scale for a per-component alias', () => {
    const names = tokens.overridePoints.map((t) => t.name);
    expect(names.some((n) => n.startsWith('--blocks-duration-'))).toBe(false);
    expect(names.some((n) => n.startsWith('--blocks-ease-'))).toBe(false);
  });

  it('publishes no token that exists only inside an at-rule', () => {
    // `--blocks-touch-target-min` / `--blocks-touch-spacing` are declared under
    // `(pointer: coarse)` and `(pointer: fine)` and nowhere else: there is no
    // base value to quote, and quoting one branch as "the default" is a lie
    // whichever branch you pick.
    const published = [
      ...tokens.durations,
      ...tokens.easings,
      ...tokens.shadows,
      ...tokens.overridePoints
    ].map((t) => t.name);
    expect(published).not.toContain('--blocks-touch-target-min');
    expect(published).not.toContain('--blocks-touch-spacing');
    expect(interactionCss, 'the tokens still exist, just not at :root').toContain(
      '--blocks-touch-target-min'
    );
  });

  it('takes the first declaration, so media-query overrides never shadow the base', () => {
    // interaction.css sets --blocks-shadow-base: none inside @media print.
    expect(tokens.shadows.find((t) => t.name === '--blocks-shadow-base')?.value).toBe(
      'var(--blocks-shadow-scale-base)'
    );
  });
});
