import { describe, expect, it } from 'vitest';
import { loadVerb } from '../data/verb-loader.js';
import { buildVerbPrompt, variantCount } from './design-prompts.js';

/** The full §8 verb table — every recipe must be present in the bundle. */
const VERB_NAMES = [
  'onboard',
  'adopt',
  'compose',
  'redesign',
  'polish',
  'critique',
  'fix',
  'retheme',
  'audit',
  'migrate'
];

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

describe('buildVerbPrompt', () => {
  const body = '1. **Context.** Read the manifest.\n2. **Validate.** Run the linter.';

  it('frames the verb and includes the recipe body', () => {
    const p = buildVerbPrompt('compose', body, {});
    expect(p).toContain('**compose** design recipe');
    expect(p).toContain('Read the manifest');
  });

  it('embeds the brief as a blockquote when provided', () => {
    expect(buildVerbPrompt('compose', body, { brief: 'a billing page' })).toContain(
      '> **a billing page**'
    );
  });

  it('inlines provided code in a svelte fence', () => {
    const p = buildVerbPrompt('redesign', body, { code: '<div>old</div>' });
    expect(p).toContain('```svelte\n<div>old</div>\n```');
  });

  it('appends a clamped variant instruction when variants are requested', () => {
    expect(buildVerbPrompt('compose', body, { variants: '9' })).toContain('explore exactly 5');
    expect(buildVerbPrompt('compose', body, { variants: '1' })).toContain('explore exactly 2');
  });

  it('degrades to a rebuild hint when the body is empty', () => {
    expect(buildVerbPrompt('compose', '', {})).toContain('rebuild the design-content bundle');
  });
});

describe('loadVerb (against the bundled recipes)', () => {
  it('loads every verb in the §8 table, non-empty', async () => {
    for (const name of VERB_NAMES) {
      const body = await loadVerb(name);
      expect(body.length, name).toBeGreaterThan(0);
    }
  });

  it('a recipe opens by reading the manifest and references the real tool surface', async () => {
    const compose = await loadVerb('compose');
    expect(compose).toContain('manifest');
    expect(compose).toContain('validate_design');
    expect(compose).toContain('get_design_principles(as="rubric")');
  });

  it('returns the empty string for an unknown verb (read tolerant)', async () => {
    expect(await loadVerb('does-not-exist')).toBe('');
  });
});
