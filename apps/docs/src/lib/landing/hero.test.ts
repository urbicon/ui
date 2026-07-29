import { describe, expect, it } from 'vitest';
import blocksCatalog from '../../../static/blocks/_catalog.json';
import { formatKb, SHARED_PREVIEW_NOTES } from './hero';

type CatalogEntry = { slug: string };

/**
 * The Guide family is the one set of rows that shares a single preview, and the
 * notes that say so are hand-written. A tenth surface — or a renamed slug —
 * would otherwise land in the hero as an unexplained repeat of the same card,
 * which is the exact thing the notes exist to prevent.
 */
describe('SHARED_PREVIEW_NOTES', () => {
  const guideSlugs = (blocksCatalog as CatalogEntry[])
    .map((e) => e.slug)
    .filter((slug) => slug === 'guide' || slug.startsWith('guide-'));

  it('covers every Guide row the catalogue ships, and invents none', () => {
    expect(Object.keys(SHARED_PREVIEW_NOTES).sort()).toEqual([...guideSlugs].sort());
  });

  it('says something about each one', () => {
    for (const [slug, note] of Object.entries(SHARED_PREVIEW_NOTES)) {
      expect(note.length, `${slug} has no note`).toBeGreaterThan(20);
    }
  });
});

describe('formatKb', () => {
  it('renders an em dash rather than a zero-looking measurement', () => {
    expect(formatKb(null)).toBe('—');
  });

  it('keeps one decimal', () => {
    expect(formatKb(2048)).toBe('2.0');
  });
});
