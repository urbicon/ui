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
