import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseDeclarations, parseInteractionTokens } from './interaction-tokens';

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
    expect(tokens.shadows.every((t) => t.value.startsWith('var(--color-shadow-'))).toBe(true);
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

  it('does not mistake the base scale for a per-component alias', () => {
    const names = tokens.overridePoints.map((t) => t.name);
    expect(names.some((n) => n.startsWith('--blocks-duration-'))).toBe(false);
    expect(names.some((n) => n.startsWith('--blocks-ease-'))).toBe(false);
  });
});

describe('parseDeclarations', () => {
  it('takes the first declaration, so media-query overrides never shadow the base', () => {
    // interaction.css sets --blocks-shadow-base: none inside @media print.
    const rows = parseDeclarations(interactionCss);
    const base = rows.filter((r) => r.name === '--blocks-shadow-base');
    expect(base.length).toBe(1);
    expect(base[0].value).toBe('var(--color-shadow-base)');
  });

  it('keeps multi-line and nested-paren values intact', () => {
    const rows = parseDeclarations(`:root {
      --a: light-dark(
        oklch(from var(--x) l c h),
        oklch(from var(--y) l c h)
      );
    }`);
    expect(rows).toEqual([
      { name: '--a', value: 'light-dark( oklch(from var(--x) l c h), oklch(from var(--y) l c h) )' }
    ]);
  });

  it('ignores declarations that appear only in comments', () => {
    const rows = parseDeclarations(`:root {
      /* --blocks-duration-fast: 999ms; */
      --blocks-duration-fast: 150ms;
    }`);
    expect(rows).toEqual([{ name: '--blocks-duration-fast', value: '150ms' }]);
  });
});
