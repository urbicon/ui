import { describe, expect, it } from 'vitest';
import { designPagePrompt, redesignPrompt, variantCount } from './design-prompts.js';

describe('variantCount', () => {
  it('defaults to 3 for missing or non-numeric input', () => {
    expect(variantCount(undefined)).toBe(3);
    expect(variantCount('abc')).toBe(3);
  });
  it('clamps to the 2–5 range', () => {
    expect(variantCount('1')).toBe(2);
    expect(variantCount('9')).toBe(5);
    expect(variantCount('4')).toBe(4);
  });
});

describe('designPagePrompt', () => {
  it('embeds the brief and drives the full loop in order', () => {
    const p = designPagePrompt('a billing settings page', undefined, '4');
    expect(p).toContain('a billing settings page');
    for (const marker of [
      'design.manifest.md',
      'get_design_principles',
      'validate_design',
      'get_design_principles(as="rubric")',
      'urbicon sync-manifest'
    ]) {
      expect(p, marker).toContain(marker);
    }
    expect(p).toContain('Generate 4 variants');
  });

  it('pins a specific pattern when given one', () => {
    expect(designPagePrompt('x', 'dashboard', undefined)).toContain('get_pattern("dashboard")');
  });
  it('offers pattern discovery when none is given', () => {
    expect(designPagePrompt('x', undefined, undefined)).toContain('if a composition pattern fits');
  });
});

describe('redesignPrompt', () => {
  it('is diagnosis-first and preserves behaviour', () => {
    const p = redesignPrompt('the dashboard feels flat', undefined, undefined);
    expect(p).toContain('Diagnose');
    expect(p).toContain('validate_design');
    expect(p).toContain('two lowest-scoring criteria');
    expect(p).toContain('read the current implementation');
  });
  it('inlines provided code', () => {
    expect(redesignPrompt('x', '<div>old</div>', undefined)).toContain('<div>old</div>');
  });
});
