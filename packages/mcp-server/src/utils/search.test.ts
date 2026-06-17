import { describe, expect, it } from 'vitest';
import type { ComponentCatalogEntry } from '../data/catalog-loader.js';
import { matchComponents } from './search.js';

function makeEntry(
  overrides: Partial<ComponentCatalogEntry> & Pick<ComponentCatalogEntry, 'name' | 'slug'>
): ComponentCatalogEntry {
  return {
    package: '@urbicon-ui/blocks',
    group: 'primitives',
    description: '',
    tags: [],
    import: `import { ${overrides.name} } from '@urbicon-ui/blocks';`,
    llmTxtPath: '',
    variants: [],
    keyProps: [],
    keyPropTypes: {},
    slots: [],
    hasExamples: false,
    relatedComponents: [],
    ...overrides
  };
}

const Button = makeEntry({
  name: 'Button',
  slug: 'button',
  description: 'Click to trigger an action',
  tags: ['action'],
  keyProps: ['intent', 'variant', 'size']
});

const Input = makeEntry({
  name: 'Input',
  slug: 'input',
  description: 'Single-line text field',
  tags: ['form'],
  keyProps: ['value', 'error']
});

const Dialog = makeEntry({
  name: 'Dialog',
  slug: 'dialog',
  description: 'Modal overlay container',
  tags: ['overlay']
});

const catalog = [Button, Input, Dialog];

describe('matchComponents', () => {
  it('ranks an exact name match first', () => {
    const results = matchComponents(catalog, 'button');
    expect(results[0]?.name).toBe('Button');
  });

  it('matches by case-insensitive substring of the name', () => {
    const results = matchComponents(catalog, 'Butt');
    expect(results.some((r) => r.name === 'Button')).toBe(true);
  });

  it('fuzz-matches a single-character typo', () => {
    const results = matchComponents(catalog, 'Buton'); // typo: missing "t"
    expect(results[0]?.name).toBe('Button');
  });

  it('ignores matches that are too distant', () => {
    const results = matchComponents(catalog, 'xyzzy');
    expect(results).toEqual([]);
  });

  it('scores tag matches when the tag keyword is present in the query', () => {
    const results = matchComponents(catalog, 'form');
    expect(results[0]?.name).toBe('Input');
  });

  it('filters by the explicit tags argument', () => {
    const results = matchComponents(catalog, 'container', ['overlay']);
    expect(results.some((r) => r.name === 'Dialog')).toBe(true);
  });

  it('respects the limit', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      makeEntry({ name: `Button${i}`, slug: `button-${i}`, description: 'click' })
    );
    const results = matchComponents(many, 'button', undefined, 3);
    expect(results).toHaveLength(3);
  });

  it('drops words shorter than two characters before matching', () => {
    // "a" and "x" below are too short and should be filtered;
    // only "button" remains and should drive the match.
    const results = matchComponents(catalog, 'a x button');
    expect(results[0]?.name).toBe('Button');
  });

  it('uses the prop-name match as a weak signal', () => {
    const results = matchComponents(catalog, 'intent');
    expect(results.some((r) => r.name === 'Button')).toBe(true);
  });

  it('returns an empty list when the query has no usable keywords', () => {
    const results = matchComponents(catalog, ', , ');
    expect(results).toEqual([]);
  });
});
