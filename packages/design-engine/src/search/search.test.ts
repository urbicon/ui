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

// The ranker read names, tags, descriptions and prop names — never the summary,
// the prop docs or the variant values the bundle ships. Measured on 8.17:
// `find "dense settings"` returned AccountSettings alone, although Toggle's
// `variant` prop says "Use `dot` for dense settings rows".
describe('matchComponents — scores what the bundle ships', () => {
  const Toggle = makeEntry({
    name: 'Toggle',
    slug: 'toggle',
    description: 'Accessible switch control for boolean on/off states.',
    summary: 'On or off, with the switch to say which.',
    tags: ['form'],
    keyProps: ['checked', 'label', 'variant'],
    propDocs: {
      variant: {
        description: 'Visual style. Use `dot` for dense settings rows.',
        summary: 'Switch-pill or a small monochrome dot.'
      },
      tier: {
        description: 'Semantic radius tier.',
        summary: 'Corner-radius tier — how round the control reads.'
      }
    },
    variants: [
      {
        name: 'variant',
        values: ['default', 'dot'],
        default: 'default',
        valueDescriptions: { dot: 'Small indicator dot left of the label — outline only when off.' }
      },
      { name: 'size', values: ['sm', 'md'] }
    ]
  });
  const AccountSettings = makeEntry({
    name: 'AccountSettings',
    slug: 'account-settings',
    description: 'Profile, password and sessions on one page.',
    tags: ['form']
  });
  const Kbd = makeEntry({
    name: 'Kbd',
    slug: 'kbd',
    description: 'Keyboard-key hint rendered as a keycap.',
    summary: 'A keyboard shortcut, drawn as the key you press.',
    tags: ['display']
  });
  const Badge = makeEntry({
    name: 'Badge',
    slug: 'badge',
    description: 'Status label.',
    variants: [
      { name: 'variant', values: ['filled', 'dot'] },
      { name: 'size', values: ['sm', 'md'] }
    ]
  });
  const shipped = [AccountSettings, Badge, Kbd, Toggle];

  it('finds a component through its summary alone', () => {
    // "shortcut" is in Kbd's summary and nowhere else on the entry.
    expect(matchComponents(shipped, 'shortcut').map((r) => r.name)).toEqual(['Kbd']);
  });

  it('finds a component through a prop @summary alone', () => {
    // "corner" occurs only in the `tier` prop's summary.
    expect(matchComponents(shipped, 'corner').map((r) => r.name)).toEqual(['Toggle']);
  });

  it('reaches a component through what a prop description says', () => {
    const names = matchComponents(shipped, 'dense settings').map((r) => r.name);
    expect(names[0]).toBe('AccountSettings');
    expect(names).toContain('Toggle');
  });

  it('finds a component through a value description', () => {
    // "indicator" occurs only in the `dot` value's description.
    expect(matchComponents(shipped, 'indicator').map((r) => r.name)).toEqual(['Toggle']);
  });

  it('ranks a variant-value hit, the documented value ahead of the bare one', () => {
    expect(matchComponents(shipped, 'dot').map((r) => r.name)).toEqual(['Toggle', 'Badge']);
  });

  it('matches a variant value exactly, never as a substring', () => {
    const Pill = makeEntry({
      name: 'Pill',
      slug: 'pill',
      variants: [{ name: 'size', values: ['small'] }]
    });
    expect(matchComponents([Pill], 'sm')).toEqual([]);
    expect(matchComponents([Pill], 'small').map((r) => r.name)).toEqual(['Pill']);
  });

  it('lets a name hit outrank summary, description and prop-doc hits together', () => {
    // Toggle says "switch" in all three; an exact and a substring name hit still win.
    const Switch = makeEntry({ name: 'Switch', slug: 'switch', description: 'Two-state control.' });
    const SwitchField = makeEntry({ name: 'SwitchField', slug: 'switch-field' });
    expect(matchComponents([Toggle, Switch], 'switch')[0]?.name).toBe('Switch');
    expect(matchComponents([Toggle, SwitchField], 'switch')[0]?.name).toBe('SwitchField');
  });

  it('counts a prop-doc hit once per word, however many props say it', () => {
    const Wide = makeEntry({
      name: 'Wide',
      slug: 'wide',
      propDocs: {
        a: { description: 'Rows here.' },
        b: { description: 'Rows there.' },
        c: { description: 'Rows again.' }
      }
    });
    const Narrow = makeEntry({ name: 'Narrow', slug: 'narrow', description: 'Rows of data.' });
    expect(matchComponents([Wide, Narrow], 'rows').map((r) => r.name)).toEqual(['Narrow', 'Wide']);
  });

  it('matches prop docs at word starts only', () => {
    const Pointer = makeEntry({
      name: 'Pointer',
      slug: 'pointer',
      propDocs: { dir: { description: 'Direction of the arrow.' } }
    });
    const Grid = makeEntry({
      name: 'Grid',
      slug: 'grid',
      propDocs: { rows: { description: 'Number of rows.' } }
    });
    expect(matchComponents([Pointer, Grid], 'row').map((r) => r.name)).toEqual(['Grid']);
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
