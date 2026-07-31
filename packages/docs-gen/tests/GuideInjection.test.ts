import { describe, expect, it } from 'vitest';
import {
  assertGuideSlug,
  demoteHeadings,
  guidePlaceholder,
  renderGuideForEmbedding,
  stripLeadingH1
} from '../src/generators/llm/guide-injection';

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

  describe('renderGuideForEmbedding', () => {
    it('strips the title and demotes the remaining hierarchy one level', () => {
      const md = '# @urbicon-ui/auth\n\n## Architecture\n\nprose\n\n### Runtime\n\nmore';
      expect(renderGuideForEmbedding(md)).toBe('### Architecture\n\nprose\n\n#### Runtime\n\nmore');
    });
  });
});
