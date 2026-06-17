import { describe, expect, it } from 'vitest';
import { parseComponentNames, parseIconMetadata } from './icon-loader.js';

const FIXTURE = `
// Simulated icon.context.ts content
import type { Component } from 'svelte';
import HomeIcon from './HomeIcon.svelte';
import SearchIcon from './SearchIcon.svelte';

export const DEFAULT_ICONS = {
  home: HomeIcon,
  search: SearchIcon,
  arrowRight: ArrowRightIcon
};

export const ICON_METADATA = {
  home: { label: 'Home', categories: ['navigation'], keywords: ['house', 'start'] },
  search: { label: 'Search', categories: ['navigation', 'ui'], keywords: ['find', 'lookup'] },
  arrowRight: { label: 'Arrow Right', categories: ['navigation'], keywords: [] }
};
`;

describe('parseComponentNames', () => {
  it('builds a name → ComponentName map from DEFAULT_ICONS', () => {
    const map = parseComponentNames(FIXTURE);
    expect(map.get('home')).toBe('HomeIcon');
    expect(map.get('search')).toBe('SearchIcon');
    expect(map.get('arrowRight')).toBe('ArrowRightIcon');
  });

  it('returns an empty map when the DEFAULT_ICONS block is missing', () => {
    const map = parseComponentNames('const NOT_IT = {};');
    expect(map.size).toBe(0);
  });
});

describe('parseIconMetadata', () => {
  it('extracts label, categories, and keywords per entry', () => {
    const entries = parseIconMetadata(FIXTURE);
    expect(entries).toHaveLength(3);

    const home = entries.find((e) => e.name === 'home');
    expect(home).toMatchObject({
      name: 'home',
      componentName: 'HomeIcon',
      label: 'Home',
      categories: ['navigation'],
      keywords: ['house', 'start']
    });
  });

  it('uses the DEFAULT_ICONS mapping for componentName when available', () => {
    const entries = parseIconMetadata(FIXTURE);
    const search = entries.find((e) => e.name === 'search');
    expect(search?.componentName).toBe('SearchIcon');
  });

  it('falls back to a capitalised name + "Icon" suffix when no mapping exists', () => {
    const withoutMapping = `
      export const ICON_METADATA = {
        custom: { label: 'Custom', categories: ['x'], keywords: ['y'] }
      };
    `;
    const entries = parseIconMetadata(withoutMapping);
    expect(entries[0]?.componentName).toBe('CustomIcon');
  });

  it('returns an empty array when ICON_METADATA block is missing', () => {
    expect(parseIconMetadata('// nothing to see')).toEqual([]);
  });

  it('handles empty categories and keywords arrays gracefully', () => {
    const fixture = `
      export const ICON_METADATA = {
        minimal: { label: 'Minimal', categories: [], keywords: [] }
      };
    `;
    const entries = parseIconMetadata(fixture);
    expect(entries[0]).toMatchObject({
      name: 'minimal',
      categories: [],
      keywords: []
    });
  });
});
