import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCatalogPath,
  getComponentLlmPath,
  getContentDir,
  getDesignSystemDir,
  getGuideIndexPath,
  getGuidePath,
  getIconsPath,
  getTemplatePath
} from './content-loader.js';

describe('content-loader paths', () => {
  const original = process.env.URBICON_CONTENT_DIR;

  afterEach(() => {
    if (original === undefined) delete process.env.URBICON_CONTENT_DIR;
    else process.env.URBICON_CONTENT_DIR = original;
  });

  describe('getContentDir', () => {
    beforeEach(() => {
      delete process.env.URBICON_CONTENT_DIR;
    });

    it('defaults to the package-relative content/ dir', () => {
      expect(getContentDir().endsWith('/content')).toBe(true);
    });

    it('honours the URBICON_CONTENT_DIR override', () => {
      process.env.URBICON_CONTENT_DIR = '/custom/bundle';
      expect(getContentDir()).toBe('/custom/bundle');
    });
  });

  describe('derived artifact paths', () => {
    beforeEach(() => {
      process.env.URBICON_CONTENT_DIR = '/bundle';
    });

    it('resolves each artifact under the content dir', () => {
      expect(getCatalogPath()).toBe('/bundle/component-catalog.json');
      expect(getDesignSystemDir()).toBe('/bundle/design-system');
      expect(getTemplatePath()).toBe('/bundle/guides/llms-full-template.md');
      expect(getGuideIndexPath()).toBe('/bundle/guides/index.json');
      expect(getIconsPath()).toBe('/bundle/icons.json');
    });
  });

  describe('getGuidePath', () => {
    beforeEach(() => {
      process.env.URBICON_CONTENT_DIR = '/bundle';
    });

    it('resolves a valid slug to guides/<slug>.md', () => {
      expect(getGuidePath('auth')).toBe('/bundle/guides/auth.md');
      expect(getGuidePath('variant-contract')).toBe('/bundle/guides/variant-contract.md');
      // digits are legal in a segment — `a2ui` is the in-tree case
      expect(getGuidePath('a2ui')).toBe('/bundle/guides/a2ui.md');
    });

    it('rejects unsafe slugs', () => {
      expect(() => getGuidePath('../escape')).toThrow('Invalid guide slug');
      expect(() => getGuidePath('Auth')).toThrow('Invalid guide slug');
      expect(() => getGuidePath('')).toThrow('Invalid guide slug');
    });
  });

  describe('getComponentLlmPath', () => {
    beforeEach(() => {
      process.env.URBICON_CONTENT_DIR = '/bundle';
    });

    it('resolves a valid slug under its group', () => {
      expect(getComponentLlmPath('blocks/primitives', 'button')).toBe(
        '/bundle/blocks/primitives/button/llm.txt'
      );
    });

    it('accepts multi-word hyphenated slugs', () => {
      expect(getComponentLlmPath('blocks/components', 'date-picker')).toBe(
        '/bundle/blocks/components/date-picker/llm.txt'
      );
    });

    it('rejects uppercase, whitespace, and edge hyphens', () => {
      expect(() => getComponentLlmPath('x', 'Button')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('x', 'bad slug')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('x', '-bad')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('x', 'bad-')).toThrow(/Invalid component slug/);
    });

    it('rejects path-traversal attempts (dotted segments fail the slug guard first)', () => {
      expect(() => getComponentLlmPath('x', '..')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('x', '../../../etc/passwd')).toThrow(
        /Invalid component slug/
      );
    });
  });
});
