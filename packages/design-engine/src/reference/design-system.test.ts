import { describe, expect, it } from 'vitest';
import { extractPrincipleSection, PRINCIPLE_TOPICS, parsePatternEntry } from './design-system.js';

const PRINCIPLES = `# Principles

Intro line.

## Visual Hierarchy

Size and weight before colour.

## Theming

Token hierarchy and paradigms.

## Accessibility

Focus-visible everywhere.
`;

describe('extractPrincipleSection', () => {
  it('extracts a topic section up to the next ## heading', () => {
    const section = extractPrincipleSection(PRINCIPLES, 'theming');
    expect(section).toContain('## Theming');
    expect(section).toContain('Token hierarchy');
    expect(section).not.toContain('## Accessibility');
    expect(section).not.toContain('## Visual Hierarchy');
  });

  it('extracts the last section to the end of the document', () => {
    const section = extractPrincipleSection(PRINCIPLES, 'accessibility');
    expect(section).toContain('Focus-visible everywhere.');
  });

  it('returns null when the heading is absent', () => {
    expect(extractPrincipleSection(PRINCIPLES, 'layout')).toBeNull();
  });

  it('covers every declared topic name with a heading mapping', () => {
    for (const topic of PRINCIPLE_TOPICS) {
      // Absent heading → null, but never a throw or an accidental full-document return.
      const result = extractPrincipleSection(`## X\n`, topic);
      expect(result).toBeNull();
    }
  });
});

describe('parsePatternEntry', () => {
  it('parses title and first prose line as description', () => {
    const entry = parsePatternEntry(
      'settings-page',
      '# Settings Page\n\nSectioned form pages with sticky save.\n\n## Layout\n…'
    );
    expect(entry.name).toBe('settings-page');
    expect(entry.title).toBe('Settings Page');
    expect(entry.description).toBe('Sectioned form pages with sticky save.');
    expect(entry.content).toContain('## Layout');
  });

  it('falls back to empty strings when title or prose is missing', () => {
    const entry = parsePatternEntry('bare', 'no heading here');
    expect(entry.title).toBe('');
    expect(entry.description).toBe('');
  });

  it('does not read a sub-heading as the description', () => {
    const entry = parsePatternEntry('x', '# Title\n\n## Directly a section\nBody.');
    expect(entry.description).toBe('');
  });
});
