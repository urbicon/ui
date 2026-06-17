import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDesignSystemDir } from '../utils/paths.js';
import {
  extractPrincipleSection,
  getPatternByName,
  loadPatterns,
  loadPrinciples
} from './design-system-loader.js';

const dsDir = getDesignSystemDir();
const principlesAvailable = existsSync(resolve(dsDir, 'principles.md'));
const patternsAvailable = existsSync(resolve(dsDir, 'patterns'));

describe.skipIf(!principlesAvailable)('loadPrinciples', () => {
  it('loads principles as a non-empty string', async () => {
    const principles = await loadPrinciples();
    expect(principles.length).toBeGreaterThan(0);
  });

  it('contains expected topic headings', async () => {
    const principles = await loadPrinciples();
    expect(principles).toContain('## Visual Hierarchy');
    expect(principles).toContain('## Theming');
    expect(principles).toContain('## Component Selection');
  });
});

describe.skipIf(!principlesAvailable)('extractPrincipleSection', () => {
  it('extracts a specific topic section', async () => {
    const principles = await loadPrinciples();
    const section = extractPrincipleSection(principles, 'theming');
    expect(section).not.toBeNull();
    expect(section).toContain('## Theming');
    expect(section).not.toContain('## Visual Hierarchy');
  });

  it('returns null for unknown topics', async () => {
    const principles = await loadPrinciples();
    // @ts-expect-error testing invalid input
    const section = extractPrincipleSection(principles, 'nonexistent');
    expect(section).toBeNull();
  });
});

describe.skipIf(!patternsAvailable)('loadPatterns', () => {
  it('loads at least one pattern', async () => {
    const patterns = await loadPatterns();
    expect(patterns.length).toBeGreaterThan(0);
  });

  it('each pattern has required fields', async () => {
    const patterns = await loadPatterns();
    for (const p of patterns) {
      expect(p.name).toBeTruthy();
      expect(p.title).toBeTruthy();
      expect(p.description).toBeTruthy();
      expect(p.content.length).toBeGreaterThan(0);
    }
  });

  it('patterns are sorted by name', async () => {
    const patterns = await loadPatterns();
    const names = patterns.map((p) => p.name);
    expect(names).toEqual([...names].sort());
  });
});

describe.skipIf(!patternsAvailable)('getPatternByName', () => {
  it('finds an existing pattern', async () => {
    const pattern = await getPatternByName('settings-page');
    expect(pattern).not.toBeNull();
    expect(pattern?.name).toBe('settings-page');
    expect(pattern?.title).toBe('Settings Page');
  });

  it('returns null for unknown patterns', async () => {
    const pattern = await getPatternByName('nonexistent');
    expect(pattern).toBeNull();
  });
});
