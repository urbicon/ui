import { describe, expect, it } from 'vitest';
import {
  excerptFor,
  hrefFor,
  parseQuery,
  type SearchRecord,
  searchRecords,
  tokenize
} from './search';

const record = (over: Partial<SearchRecord>): SearchRecord => ({
  r: '/x',
  t: '',
  p: '',
  b: '',
  k: 'prose',
  ...over
});

/** Shaped like the real index: prose from the HTML, API surface from `api.ts`. */
const index: SearchRecord[] = [
  record({
    r: '/customization/themes',
    a: 'dark-mode',
    t: 'Dark Mode',
    p: 'Themes',
    b: 'Design tokens automatically adapt to dark mode using light-dark().'
  }),
  record({
    r: '/customization/tokens',
    a: 'interaction',
    t: 'Motion & Depth',
    p: 'Tokens',
    b: 'prefers-contrast: more widens the focus ring to 3px and promotes borders.'
  }),
  record({
    r: '/blocks/primitives/toggle',
    a: 'accessibility',
    t: 'Accessibility',
    p: 'Toggle Component',
    b: 'Keyboard Tab to focus, Space to toggle. The focus ring uses focus-visible.'
  }),
  record({
    r: '/blocks/primitives/avatar',
    a: 'api',
    t: 'Avatar API',
    p: 'Avatar',
    n: 'src alt size ring status clickable',
    b: 'clickable Mark the avatar as clickable (adds hover/focus styles and keyboard support).',
    k: 'api'
  }),
  record({
    r: '/blocks/primitives/checkbox',
    a: 'api',
    t: 'Checkbox API',
    p: 'Checkbox',
    n: 'checked indeterminate oncheckedchange on change size',
    b: 'indeterminate Visual-only third state showing a dash icon. Resets to unchecked on next user toggle.',
    k: 'api'
  }),
  // Prose records carry no `n`, so a name only ever reaches them as one word.
  record({
    r: '/customization/blocks-provider',
    a: 'presets',
    t: 'Named Presets',
    p: 'BlocksProvider',
    b: 'Register a preset on BlocksProvider and reference it by name from any component.'
  }),
  record({
    r: '/blocks/components/date-picker',
    a: 'usage',
    t: 'Usage',
    p: 'DatePicker Component',
    b: 'The date picker opens a Calendar in a popover and writes back an ISO string.'
  })
];

describe('tokenize', () => {
  it('lowercases and splits on non-alphanumerics', () => {
    expect(tokenize('Dark Mode!')).toEqual(['dark', 'mode']);
  });

  it('keeps the joined symbol and adds its camelCase parts', () => {
    expect(tokenize('onCheckedChange')).toEqual(['oncheckedchange', 'on', 'checked', 'change']);
  });

  it('deduplicates', () => {
    expect(tokenize('focus focus')).toEqual(['focus']);
  });

  it('returns nothing for punctuation-only input', () => {
    expect(tokenize('  ?? ')).toEqual([]);
  });
});

describe('parseQuery', () => {
  it('keeps a camelCase word as one term and carries its parts alongside', () => {
    expect(parseQuery('PasskeyManager')).toEqual([
      { token: 'passkeymanager', parts: ['passkey', 'manager'] }
    ]);
  });

  it('emits one term per typed word', () => {
    expect(parseQuery('dark mode!')).toEqual([
      { token: 'dark', parts: [] },
      { token: 'mode', parts: [] }
    ]);
  });

  it('collapses a repeated word', () => {
    expect(parseQuery('focus focus')).toEqual([{ token: 'focus', parts: [] }]);
  });

  it('returns nothing for punctuation-only input', () => {
    expect(parseQuery('  ?? ')).toEqual([]);
  });
});

describe('searchRecords', () => {
  it('returns nothing for an empty query', () => {
    expect(searchRecords(index, '   ')).toEqual([]);
  });

  it('requires every term to hit (AND), not any', () => {
    // "toggle" appears alone in several records; paired with "zzz" nothing may match.
    expect(searchRecords(index, 'toggle zzz')).toEqual([]);
  });

  it('ranks a title hit above a body hit', () => {
    const [top] = searchRecords(index, 'dark mode');
    expect(top.href).toBe('/customization/themes#dark-mode');
  });

  // Regression: one incidental name hit (Avatar has a `ring` prop) must not
  // outrank a record that literally documents the phrase.
  it('ranks a literal phrase above an incidental symbol-name hit', () => {
    const hits = searchRecords(index, 'focus ring');
    expect(hits[0].record.r).not.toBe('/blocks/primitives/avatar');
    expect(hits.map((h) => h.href)).toContain('/customization/tokens#interaction');
  });

  // Regression: unanchored substring matching makes "ring" hit "during".
  it('anchors matches to word starts', () => {
    const noise = [record({ t: 'Timing', b: 'Applied during the transition, bringing a string.' })];
    expect(searchRecords(noise, 'ring')).toEqual([]);
  });

  it('still matches a half-typed word, so type-ahead works', () => {
    const hits = searchRecords(index, 'togg');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.some((h) => h.record.r === '/blocks/primitives/toggle')).toBe(true);
  });

  it('finds a prop name that the prerendered HTML never contains', () => {
    const hits = searchRecords(index, 'onCheckedChange');
    expect(hits[0].href).toBe('/blocks/primitives/checkbox#api');
  });

  it('finds a prop by its camelCase parts', () => {
    expect(searchRecords(index, 'checked change')[0].href).toBe('/blocks/primitives/checkbox#api');
  });

  it('finds a prop by its description text', () => {
    expect(searchRecords(index, 'Visual-only third state')[0].href).toBe(
      '/blocks/primitives/checkbox#api'
    );
  });

  // Regression: `tokenize` made the camelCase parts *mandatory* terms, so
  // "BlocksProvider" demanded a separate word starting with "provider" and found
  // nothing — while "blocksprovider" found the page. Measured on the real 650-record
  // index, 43 of 52 multi-word component names found less in their documented casing.
  it('finds a component by its own name, spelled as the docs spell it', () => {
    expect(searchRecords(index, 'BlocksProvider')[0].href).toBe(
      '/customization/blocks-provider#presets'
    );
    expect(searchRecords(index, 'onCheckedChange')[0].href).toBe('/blocks/primitives/checkbox#api');
  });

  // The property that keeps the above from regressing in some other form: the
  // parts are an expansion of the word, so they may only ever *add* evidence.
  it('never finds less in documented casing than in all-lowercase', () => {
    for (const name of ['BlocksProvider', 'DatePicker', 'PasskeyManager', 'onCheckedChange']) {
      const cased = searchRecords(index, name, { limit: 50 });
      const lower = searchRecords(index, name.toLowerCase(), { limit: 50 });
      const casedHrefs = cased.map((hit) => hit.href);
      for (const hit of lower) expect(casedHrefs).toContain(hit.href);
    }
  });

  // The reason the parts are carried at all — they must stay optional, not mandatory.
  it('finds a component whose name the prose splits into words', () => {
    const hits = searchRecords(index, 'DatePicker');
    expect(hits.map((hit) => hit.href)).toContain('/blocks/components/date-picker#usage');
  });

  it('still finds a component from the spaced-out spelling of its name', () => {
    expect(searchRecords(index, 'date picker')[0].record.r).toBe('/blocks/components/date-picker');
  });

  // A part on its own is not the word: "date" must not pass for "DatePicker".
  it('does not credit a partial camelCase match', () => {
    const dateOnly = [record({ t: 'Release Dates', b: 'A date is stored as an ISO string.' })];
    expect(searchRecords(dateOnly, 'DatePicker')).toEqual([]);
  });

  it('caps results', () => {
    expect(searchRecords(index, 'the', { limit: 2 }).length).toBeLessThanOrEqual(2);
  });

  it('breaks score ties on the tighter record', () => {
    const tied = [
      record({ t: 'Focus', b: `focus ${'padding '.repeat(50)}` }),
      record({ r: '/short', t: 'Focus', b: 'focus' })
    ];
    expect(searchRecords(tied, 'focus')[0].record.r).toBe('/short');
  });
});

describe('hrefFor', () => {
  it('deep-links to the anchor when there is one', () => {
    expect(hrefFor(record({ r: '/a', a: 'b' }))).toBe('/a#b');
  });

  it('falls back to the route for page-level records', () => {
    expect(hrefFor(record({ r: '/a' }))).toBe('/a');
  });
});

describe('excerptFor', () => {
  it('centres on the match and ellipses both ends', () => {
    const long = record({ b: `${'a '.repeat(80)}needle ${'b '.repeat(80)}` });
    const excerpt = excerptFor(long, parseQuery('needle'), 30);
    expect(excerpt).toContain('needle');
    expect(excerpt.startsWith('…')).toBe(true);
    expect(excerpt.endsWith('…')).toBe(true);
  });

  it('does not ellipse when the whole body fits', () => {
    expect(excerptFor(record({ b: 'short needle here' }), parseQuery('needle'), 90)).toBe(
      'short needle here'
    );
  });

  it('returns empty for a title-only hit', () => {
    expect(excerptFor(record({ t: 'Toggle', b: 'unrelated' }), parseQuery('toggle'), 90)).toBe('');
  });

  it('ignores an unanchored occurrence', () => {
    expect(excerptFor(record({ b: 'during' }), parseQuery('ring'), 90)).toBe('');
  });

  // The body may spell the name out, so the parts have to be able to anchor it.
  it('centres on a camelCase part when the body spells the name as words', () => {
    expect(excerptFor(record({ b: 'The date picker opens.' }), parseQuery('DatePicker'), 90)).toBe(
      'The date picker opens.'
    );
  });
});
