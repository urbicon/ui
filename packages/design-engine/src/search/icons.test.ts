import { describe, expect, it } from 'vitest';
import { type IconEntry, matchIcons } from './icons.js';

const ICONS: IconEntry[] = [
  {
    name: 'search',
    componentName: 'SearchIcon',
    label: 'Search',
    categories: ['action'],
    keywords: ['find', 'magnifier', 'lookup']
  },
  {
    name: 'settings',
    componentName: 'SettingsIcon',
    label: 'Settings',
    categories: ['action'],
    keywords: ['gear', 'preferences', 'configuration']
  },
  {
    name: 'calendar',
    componentName: 'CalendarIcon',
    label: 'Calendar',
    categories: ['data'],
    keywords: ['date', 'schedule', 'month']
  }
];

describe('matchIcons', () => {
  it('ranks an exact name match first', () => {
    const results = matchIcons(ICONS, 'search');
    expect(results[0]?.name).toBe('search');
  });

  it('matches via keywords', () => {
    const results = matchIcons(ICONS, 'gear');
    expect(results.map((r) => r.name)).toEqual(['settings']);
  });

  it('matches via category', () => {
    const results = matchIcons(ICONS, 'data');
    expect(results.map((r) => r.name)).toEqual(['calendar']);
  });

  it('drops zero-score entries and returns empty for no match', () => {
    expect(matchIcons(ICONS, 'zzzz')).toEqual([]);
  });

  it('respects the limit', () => {
    const results = matchIcons(ICONS, 'action', 1);
    expect(results).toHaveLength(1);
  });
});

// Both cases below were found by probing the matcher with the vocabulary a
// developer actually types, against the real registry — not hypotheticals.
describe('matchIcons (ranking)', () => {
  const icon = (name: string, keywords: string[], categories = ['action']): IconEntry => ({
    name,
    componentName: `${name.charAt(0).toUpperCase()}${name.slice(1)}Icon`,
    label: name,
    categories,
    keywords
  });

  it('puts the icon that lists the term first ahead of one that lists it later', () => {
    // "delete" used to return folderMinus/minusCircle/strikethrough/userX and not
    // `trash` at all: every one of them scored a flat 5, so registry order won.
    const icons = [
      icon('folderMinus', ['remove', 'delete', 'directory']),
      icon('minusCircle', ['remove', 'subtract', 'delete']),
      icon('trash', ['delete', 'remove', 'bin'])
    ];
    expect(matchIcons(icons, 'delete')[0]?.name).toBe('trash');
  });

  it('does not match a query against the seam of `<name>Icon`', () => {
    // "MapIcon"/"GraduationCapIcon"/"PlugZapIcon" all contain "api" across the
    // name→Icon seam, and scored +7 for it — above `code`, which has the keyword.
    const icons = [icon('map', ['location']), icon('code', ['api', 'source'])];
    const names = matchIcons(icons, 'api').map((r) => r.name);
    expect(names).toEqual(['code']);
  });

  it('still matches a component name pasted out of code', () => {
    const icons = [icon('map', ['location']), icon('code', ['api'])];
    expect(matchIcons(icons, 'MapIcon')[0]?.name).toBe('map');
  });

  it('scores an exact keyword above a merely partial one', () => {
    // Neither name contains "delete", so this isolates the keyword tiers: a name
    // hit outranks both (`undeleteAll` would win on +7 for the name alone).
    const icons = [icon('restore', ['undelete-file']), icon('trash', ['delete'])];
    expect(matchIcons(icons, 'delete').map((r) => r.name)).toEqual(['trash', 'restore']);
  });

  it('breaks a full tie deterministically rather than by registry order', () => {
    const a = [icon('folderMinus', ['delete']), icon('trash', ['delete'])];
    const b = [icon('trash', ['delete']), icon('folderMinus', ['delete'])];
    expect(matchIcons(a, 'delete').map((r) => r.name)).toEqual(
      matchIcons(b, 'delete').map((r) => r.name)
    );
  });
});
