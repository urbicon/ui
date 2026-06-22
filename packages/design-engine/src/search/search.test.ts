import { describe, expect, it } from 'vitest';
import { matchComponents } from './match.js';
import { extractSection } from './section.js';
import type { ComponentCatalogEntry } from './types.js';

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

// Regression for the DateGrid/Planner discovery fix: planning-board queries
// used to steer toward Calendar (a timed-event scheduler). With Planner in the
// catalog they must land on Planner instead — driven purely by its catalog
// description/tags/slug, no hardcoded keyword map.
describe('matchComponents — Planner discovery', () => {
  const Calendar = makeEntry({
    name: 'Calendar',
    slug: 'calendar',
    description: 'Event display and date selection with month, week and day views.',
    tags: ['display'],
    relatedComponents: ['DatePicker']
  });
  const Planner = makeEntry({
    name: 'Planner',
    slug: 'planner',
    description:
      'Date-indexed planning board — a week, month or custom-range grid whose cells hold your domain content (meals, shifts, bookings, content slots) via a generic cell snippet.',
    tags: ['display', 'layout'],
    keyProps: ['items', 'getDate', 'view', 'cell'],
    relatedComponents: ['Calendar', 'DatePicker']
  });
  const dateCatalog = [Calendar, Planner];

  for (const query of ['planner', 'meal planner', 'weekly plan', 'shift schedule', 'week board']) {
    it(`ranks Planner first for "${query}"`, () => {
      const results = matchComponents(dateCatalog, query);
      expect(results[0]?.name).toBe('Planner');
    });
  }

  it('still ranks Calendar first for an event/appointment query', () => {
    const results = matchComponents(dateCatalog, 'event calendar');
    expect(results[0]?.name).toBe('Calendar');
  });
});

describe('extractSection', () => {
  const llm = [
    '# Button',
    '',
    'Click to trigger an action.',
    '',
    '### Examples',
    '',
    '```svelte',
    '<Button intent="primary">Save</Button>',
    '```',
    '',
    '### API',
    '',
    '| Prop | Type | Default |',
    '| --- | --- | --- |',
    '| intent | string | primary |',
    '',
    '### Slots (slotClasses keys)',
    '',
    '`base`, `label`'
  ].join('\n');

  it('returns everything before the first ### as the overview', () => {
    const overview = extractSection(llm, 'overview');
    expect(overview).toContain('# Button');
    expect(overview).toContain('Click to trigger an action.');
    expect(overview).not.toContain('### Examples');
  });

  it('extracts a named section up to the next heading', () => {
    const api = extractSection(llm, 'api');
    expect(api).toContain('### API');
    expect(api).toContain('| intent | string | primary |');
    expect(api).not.toContain('### Slots');
  });

  it('maps the parenthesised slots heading to the slots section', () => {
    const slots = extractSection(llm, 'slots');
    expect(slots).toContain('`base`, `label`');
  });

  it('returns null for a section that is absent', () => {
    expect(extractSection(llm, 'variants')).toBe(null);
  });

  it('treats content with no headings as all-overview', () => {
    expect(extractSection('Just a description, no sections.', 'overview')).toBe(
      'Just a description, no sections.'
    );
  });
});
