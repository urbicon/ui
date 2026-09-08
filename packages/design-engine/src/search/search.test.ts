import { describe, expect, it } from 'vitest';
import { isBooleanAxis, matchComponents, searchComponents } from './match.js';
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

  it('names a fragment of a name as the closest, not as a match', () => {
    // "butt" sits inside "button": no word landed, so there is no match — the
    // nearest miss is still named.
    const { matches, closest } = searchComponents(catalog, 'Butt');
    expect(matches).toEqual([]);
    expect(closest[0]?.name).toBe('Button');
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

  for (const query of ['planner', 'meal planner', 'shift schedule', 'week board']) {
    it(`ranks Planner first for "${query}"`, () => {
      const results = matchComponents(dateCatalog, query);
      expect(results[0]?.name).toBe('Planner');
    });
  }

  it('names Planner as the closest for "weekly plan" — "plan" is a word of neither its name nor its text', () => {
    // "planner" and "planning" start with the word but are not it or its plural;
    // Calendar has neither. Nothing lands, and the nearest miss is still Planner.
    const { matches, closest } = searchComponents(dateCatalog, 'weekly plan');
    expect(matches).toEqual([]);
    expect(closest[0]?.name).toBe('Planner');
  });

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

  it('exposes the boolean-axis predicate the listing surfaces share', () => {
    expect(isBooleanAxis(['true'])).toBe(true);
    expect(isBooleanAxis(['false', 'true'])).toBe(true);
    expect(isBooleanAxis(['default', 'dot'])).toBe(false);
    expect(isBooleanAxis([])).toBe(false);
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

  it('lets an exact name beat a substring-name sibling with every text hit', () => {
    // Before the exact tier was set above the whole substring+text stack,
    // AvatarGroup (7 + 3 + 2 + 1 + 1) beat Avatar (10 + 1 + 1) for "avatar".
    const Avatar = makeEntry({
      name: 'Avatar',
      slug: 'avatar',
      description: 'User image with initials fallback.',
      keyProps: ['src', 'alt'],
      propDocs: { src: { description: 'Image of the avatar.' } }
    });
    const AvatarGroup = makeEntry({
      name: 'AvatarGroup',
      slug: 'avatar-group',
      description: 'Overlapping stack of avatars.',
      summary: 'Several avatars, one row.',
      tags: ['display'],
      keyProps: ['avatars', 'max'],
      propDocs: { avatars: { description: 'The avatars to stack.' } },
      variants: [{ name: 'size', values: ['avatar'] }]
    });
    expect(matchComponents([AvatarGroup, Avatar], 'avatar').map((r) => r.name)).toEqual([
      'Avatar',
      'AvatarGroup'
    ]);
    // With the tag too: 7 + 5 + 3 + 2 + 2 + 1 + 1 = 21 — still under 25.
    expect(matchComponents([AvatarGroup, Avatar], 'avatar', ['display'])[0]?.name).toBe('Avatar');
    // The bonus is for the whole query: the sibling's name, however spelled, wins
    // over the exact first word — this is where a per-word tier broke 22 slugs.
    for (const q of ['avatar group', 'avatar-group', 'AvatarGroup']) {
      expect(matchComponents([Avatar, AvatarGroup], q)[0]?.name).toBe('AvatarGroup');
    }
    // …while a word that is the name, inside a longer query, still wins the word:
    // with the whole-query bonus alone "small avatar" went to AvatarGroup.
    for (const q of ['small avatar', 'avatar image']) {
      expect(matchComponents([AvatarGroup, Avatar], q)[0]?.name).toBe('Avatar');
    }
  });

  it('lets a word that is a name win a two-word query against a sibling that only contains it', () => {
    const Toast = makeEntry({
      name: 'Toast',
      slug: 'toast',
      description: 'Brief notification that dismisses itself.',
      summary: 'A short notification that fades.'
    });
    const NotificationListener = makeEntry({
      name: 'NotificationListener',
      slug: 'notification-listener',
      description: 'Shows each notification as a toast.',
      summary: 'Listens for notifications and shows a toast.'
    });
    expect(matchComponents([NotificationListener, Toast], 'toast notification')[0]?.name).toBe(
      'Toast'
    );

    const ConfirmDialog = makeEntry({
      name: 'ConfirmDialog',
      slug: 'confirm-dialog',
      description: 'Modal dialog asking for confirmation.',
      summary: 'A modal dialog with two answers.',
      tags: ['overlay']
    });
    expect(matchComponents([ConfirmDialog, Dialog], 'modal dialog')[0]?.name).toBe('Dialog');
  });

  it('breaks a tie by name, not by catalog order', () => {
    const a = makeEntry({ name: 'Zeta', slug: 'zeta', description: 'Shows a tally.' });
    const b = makeEntry({ name: 'Alpha', slug: 'alpha', description: 'Shows a tally.' });
    expect(matchComponents([a, b], 'tally').map((r) => r.name)).toEqual(['Alpha', 'Zeta']);
    expect(matchComponents([b, a], 'tally').map((r) => r.name)).toEqual(['Alpha', 'Zeta']);
  });

  it('does not score the values of a boolean axis', () => {
    const Switchy = makeEntry({
      name: 'Switchy',
      slug: 'switchy',
      variants: [
        { name: 'disabled', values: ['true'] },
        { name: 'checked', values: ['false', 'true'] }
      ]
    });
    expect(matchComponents([Switchy], 'true')).toEqual([]);
    expect(matchComponents([Switchy], 'false')).toEqual([]);
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

// A match needs a word that landed whole; everything reached by fragments alone
// is the `closest` list a surface shows when there is no match. Measured on 8.18:
// `find rating` returned Separator ("separating"), `find "stat metric kpi"`
// EmptyState ("State", "states"), `find list` led with NotificationListener.
describe('searchComponents — the floor', () => {
  const Separator = makeEntry({
    name: 'Separator',
    slug: 'separator',
    description: 'Thin rule separating two groups.'
  });
  const Badge = makeEntry({
    name: 'Badge',
    slug: 'badge',
    description: 'Shows a status, in one of five states.',
    summary: 'A static label in a box, or several boxes.'
  });
  const EmptyState = makeEntry({
    name: 'EmptyState',
    slug: 'empty-state',
    description: 'What a list shows when it has no rows.'
  });
  const ChatMessageList = makeEntry({
    name: 'ChatMessageList',
    slug: 'chat-message-list',
    description: 'Scrolling column of chat messages.'
  });
  const NotificationListener = makeEntry({
    name: 'NotificationListener',
    slug: 'notification-listener',
    description: 'Listener that shows each notification as a toast.',
    propDocs: { onNotification: { description: 'Called by the listener.' } }
  });
  const shipped = [Badge, ChatMessageList, EmptyState, NotificationListener, Separator];

  it('scores nothing for a word that only occurs inside longer words', () => {
    const { matches, closest } = searchComponents(shipped, 'rating');
    expect(matches).toEqual([]);
    expect(closest).toEqual([]);
  });

  it('reports no match when a word only starts longer words, and names them as closest', () => {
    // "stat" starts "state", "states", "status", "static" — and is none of them.
    // Badge leads at 5 (description "status" 3 + summary "static" 2) over
    // EmptyState's 3 (the name fragment alone); "metric" and "kpi" hit nothing.
    const { matches, closest } = searchComponents(shipped, 'stat metric kpi');
    expect(matches).toEqual([]);
    expect(closest.map((c) => c.name)).toEqual(['Badge', 'EmptyState']);
  });

  it('lands a regular plural as the word itself', () => {
    expect(matchComponents(shipped, 'state').map((c) => c.name)).toEqual(['EmptyState', 'Badge']);
    expect(matchComponents(shipped, 'box').map((c) => c.name)).toEqual(['Badge']);
    // "states" is state + s, not stat + es: the sibilant rule keeps "stat" out.
    expect(matchComponents(shipped, 'stat')).toEqual([]);
  });

  it('lets a slug word match and a name fragment only rank', () => {
    // "list" is a word of chat-message-list and a fragment of Listener; the
    // fragment entry has more text hits and used to lead at 11 against 8.
    const { matches, closest } = searchComponents(shipped, 'list');
    expect(matches.map((c) => c.name)).toEqual(['ChatMessageList', 'EmptyState']);
    expect(closest).toEqual([]);
  });

  it('lands a name one edit away, ranks one two edits away as closest', () => {
    expect(matchComponents(shipped, 'badgr').map((c) => c.name)).toEqual(['Badge']);
    const { matches, closest } = searchComponents(shipped, 'bodgr');
    expect(matches).toEqual([]);
    expect(closest.map((c) => c.name)).toEqual(['Badge']);
  });

  it('caps the closest at three, best first', () => {
    const many = Array.from({ length: 5 }, (_, i) =>
      makeEntry({ name: `Widget${i}`, slug: `widget-${i}`, description: `Widgets ${i}` })
    );
    const { matches, closest } = searchComponents(many, 'widg');
    expect(matches).toEqual([]);
    expect(closest).toHaveLength(3);
  });

  it('does not let an explicit tag filter stand in for a word that landed', () => {
    const { matches, closest } = searchComponents(catalog, 'zzzz', ['action']);
    expect(matches).toEqual([]);
    expect(closest.map((c) => c.name)).toEqual(['Button']);
  });

  it('lands on an exact prop name, ranks a fragment of one', () => {
    expect(matchComponents(catalog, 'intent').map((c) => c.name)).toEqual(['Button']);
    const { matches, closest } = searchComponents(catalog, 'inte');
    expect(matches).toEqual([]);
    expect(closest.map((c) => c.name)).toEqual(['Button']);
  });

  it('lands a prop name in the plural, but not a longer word starting with it', () => {
    const Keyboard = makeEntry({ name: 'Keyboard', slug: 'keyboard', keyProps: ['keys'] });
    const Helper = makeEntry({ name: 'Helper', slug: 'helper', keyProps: ['helper'] });
    expect(matchComponents([Keyboard], 'key').map((c) => c.name)).toEqual(['Keyboard']);
    // `+es` after a sibilant, the same rule the text scan uses.
    const Boxes = makeEntry({ name: 'Boxes', slug: 'boxes', keyProps: ['boxes'] });
    expect(matchComponents([Boxes], 'box').map((c) => c.name)).toEqual(['Boxes']);
    // "helper" is not the plural of "help" — it stays a fragment and does not land.
    expect(searchComponents([Helper], 'help').matches).toEqual([]);
  });

  it('rejects a limit that would invert the contract', () => {
    // `slice(0, 0)` empties `matches`, which would hand every landed entry to
    // `closest` — the opposite of what both fields mean.
    expect(() => searchComponents(shipped, 'list', undefined, 0)).toThrow(RangeError);
    expect(() => searchComponents(shipped, 'list', undefined, -1)).toThrow(RangeError);
    expect(() => searchComponents(shipped, 'list', undefined, 1.5)).toThrow(RangeError);
  });

  it('lands the whole query joined, across the words it was split into', () => {
    const Tooltip = makeEntry({
      name: 'Tooltip',
      slug: 'tooltip',
      description: 'A hint on hover.'
    });
    const ToolCallCard = makeEntry({
      name: 'ToolCallCard',
      slug: 'tool-call-card',
      description: 'Shows a tool call and its result.'
    });
    const split = [ToolCallCard, Tooltip];
    expect(matchComponents(split, 'tool tip')[0]?.name).toBe('Tooltip');
    // Symmetric: one word against a hyphenated slug.
    expect(matchComponents(split, 'toolcallcard')[0]?.name).toBe('ToolCallCard');
  });

  // The class boundaries are shares of the catalog searched, and never bite below
  // UBIQUITY_FLOOR entries — so a fixture has to be wide enough to have classes at
  // all. 40 entries: filler is >30 landings, common is >10, distinctive is the rest.
  describe('word classes and the pair rule', () => {
    const wide = Array.from({ length: 40 }, (_, i) =>
      makeEntry({
        name: `Widget${String(i).padStart(2, '0')}`,
        slug: `widget-${String(i).padStart(2, '0')}`,
        description: [
          i < 35 ? 'alpha' : '',
          i < 20 ? 'beta' : '',
          i >= 10 && i < 30 ? 'gamma' : '',
          i < 3 ? 'delta' : ''
        ]
          .filter(Boolean)
          .join(' ')
      })
    );
    const names = (q: string) => matchComponents(wide, q, undefined, 40).map((c) => c.name);

    it('never lands a filler word — alpha is in 35 of 40 descriptions', () => {
      expect(names('alpha')).toEqual([]);
    });

    it('never lands a common word alone — beta is in 20 of 40', () => {
      expect(names('beta')).toEqual([]);
    });

    it('lands a distinctive word alone — delta is in 3 of 40', () => {
      expect(names('delta')).toEqual(['Widget00', 'Widget01', 'Widget02']);
    });

    it('lands two common words where they meet, and nowhere else', () => {
      // beta covers 0-19, gamma 10-29; only 10-19 carry both.
      expect(names('beta gamma')).toEqual(
        Array.from({ length: 10 }, (_, i) => `Widget${String(i + 10).padStart(2, '0')}`)
      );
    });

    it('does not let a filler word be the second half of a pair', () => {
      // The shape of "a rating component": one common word, one word that says
      // nothing. alpha covers beta's whole range, so every pairing is filler+common.
      expect(names('alpha beta')).toEqual([]);
    });
  });

  describe('closest when a weak entry outscores the matches', () => {
    const Widgetry = makeEntry({
      name: 'Widgetry',
      slug: 'widgetry',
      description: 'A panel of widgetry.'
    });
    const Holder = makeEntry({ name: 'Holder', slug: 'holder', keyProps: ['widg'] });

    it('adds the block when the best weak entry scores above the best match', () => {
      // Holder lands on an exact prop name for 1 point; Widgetry only has "widg"
      // as a fragment of its name, and outscores it. Without this the reader sees
      // the 1-point answer and never learns the other exists.
      const { matches, closest } = searchComponents([Holder, Widgetry], 'widg');
      expect(matches.map((c) => c.name)).toEqual(['Holder']);
      expect(closest.map((c) => c.name)).toEqual(['Widgetry']);
    });

    it('leaves it empty when every match outscores every weak entry', () => {
      const { matches, closest } = searchComponents(catalog, 'button');
      expect(matches[0]?.name).toBe('Button');
      expect(closest).toEqual([]);
    });
  });

  it('returns only the matches from matchComponents', () => {
    expect(matchComponents(shipped, 'stat metric kpi')).toEqual([]);
    expect(matchComponents(shipped, 'list', undefined, 1).map((c) => c.name)).toEqual([
      'ChatMessageList'
    ]);
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
