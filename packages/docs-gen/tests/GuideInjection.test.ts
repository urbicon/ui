import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  assertGuideSlug,
  demoteHeadings,
  guidePlaceholder,
  renderGuideForEmbedding,
  stripLeadingH1,
  stripTypecheckMarkers,
  TYPECHECK_MARKER
} from '../src/generators/llm/guide-injection';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures/doc-fences');

describe('guide-injection', () => {
  describe('guidePlaceholder', () => {
    it('renders the {{GUIDE:slug}} form', () => {
      expect(guidePlaceholder('auth')).toBe('{{GUIDE:auth}}');
    });
  });

  describe('assertGuideSlug', () => {
    it('accepts lowercase-hyphen slugs', () => {
      expect(() => assertGuideSlug('auth')).not.toThrow();
      expect(() => assertGuideSlug('variant-contract')).not.toThrow();
      // digits are legal in a segment — `a2ui` is the in-tree case
      expect(() => assertGuideSlug('a2ui')).not.toThrow();
    });

    it('rejects uppercase, path separators, and empty slugs', () => {
      expect(() => assertGuideSlug('Auth')).toThrow('invalid');
      expect(() => assertGuideSlug('a/b')).toThrow('invalid');
      expect(() => assertGuideSlug('')).toThrow('invalid');
      expect(() => assertGuideSlug('..')).toThrow('invalid');
    });
  });

  describe('demoteHeadings', () => {
    it('demotes every ATX heading by the given amount', () => {
      const md = '# Title\n\n## Section\n\n### Sub';
      expect(demoteHeadings(md, 1)).toBe('## Title\n\n### Section\n\n#### Sub');
    });

    it('caps at h6', () => {
      expect(demoteHeadings('###### Deep', 2)).toBe('###### Deep');
    });

    it('leaves fenced code blocks untouched', () => {
      const md = ['## Real', '```bash', '# a comment, not a heading', '```', '## Also real'].join(
        '\n'
      );
      expect(demoteHeadings(md, 1)).toBe(
        ['### Real', '```bash', '# a comment, not a heading', '```', '### Also real'].join('\n')
      );
    });

    it('does not treat hash-prefixed prose (no space) as a heading', () => {
      expect(demoteHeadings('#hashtag', 1)).toBe('#hashtag');
    });
  });

  describe('stripLeadingH1', () => {
    it('drops a leading h1 and the following blank lines', () => {
      expect(stripLeadingH1('# Title\n\nBody text')).toBe('Body text');
    });

    it('leaves documents without a leading h1 unchanged', () => {
      expect(stripLeadingH1('## Section\n\nBody')).toBe('## Section\n\nBody');
    });
  });

  describe('stripTypecheckMarkers', () => {
    it('removes exactly the marker lines of a marked document, byte for byte otherwise', () => {
      // the lint's own red fixture: three markers, prose, fences, an unmarked fence
      const source = readFileSync(join(FIXTURES, 'red.md'), 'utf8');
      const markerLines = source.split('\n').filter((l) => TYPECHECK_MARKER.test(l));
      expect(markerLines).toHaveLength(3);

      const stripped = stripTypecheckMarkers(source);
      expect(stripped).not.toContain('typecheck');
      expect(stripped).toBe(
        source
          .split('\n')
          .filter((l) => !TYPECHECK_MARKER.test(l))
          .join('\n')
      );
    });

    it('strips the directive form too', () => {
      expect(stripTypecheckMarkers('a\n<!-- typecheck: stub drizzle-orm -->\n```ts\nb\n```')).toBe(
        'a\n```ts\nb\n```'
      );
    });

    it('keeps every other HTML comment, and a marker-shaped line inside a fence', () => {
      const md = [
        '<!-- Client: listen + display -->',
        '```svelte',
        '<!-- typecheck -->',
        '<!-- … app … -->',
        '```',
        '<!-- typecheck -->',
        '```ts',
        'const a = 1;',
        '```'
      ].join('\n');
      expect(stripTypecheckMarkers(md)).toBe(
        [
          '<!-- Client: listen + display -->',
          '```svelte',
          '<!-- typecheck -->',
          '<!-- … app … -->',
          '```',
          '```ts',
          'const a = 1;',
          '```'
        ].join('\n')
      );
    });
  });

  describe('renderGuideForEmbedding', () => {
    it('strips the title and demotes the remaining hierarchy one level', () => {
      const md = '# @urbicon-ui/auth\n\n## Architecture\n\nprose\n\n### Runtime\n\nmore';
      expect(renderGuideForEmbedding(md)).toBe('### Architecture\n\nprose\n\n#### Runtime\n\nmore');
    });

    it('drops typecheck markers on the way into the embedding document', () => {
      const md = '# T\n\n## S\n\n<!-- typecheck -->\n```ts\nexport const a = 1;\n```';
      expect(renderGuideForEmbedding(md)).toBe('### S\n\n```ts\nexport const a = 1;\n```');
    });
  });
});
