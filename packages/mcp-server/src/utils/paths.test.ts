import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getCatalogPath,
  getComponentLlmPath,
  getDataDir,
  getRecipeDir,
  getTemplateDir,
  getTemplatePath,
  isWithinProjectDir
} from './paths.js';

describe('paths', () => {
  const originalDataDir = process.env.DATA_DIR;

  afterEach(() => {
    if (originalDataDir === undefined) {
      delete process.env.DATA_DIR;
    } else {
      process.env.DATA_DIR = originalDataDir;
    }
  });

  describe('isWithinProjectDir', () => {
    const original = process.env.DESIGN_PROJECT_DIR;
    beforeEach(() => {
      process.env.DESIGN_PROJECT_DIR = '/home/user/app';
    });
    afterEach(() => {
      if (original === undefined) delete process.env.DESIGN_PROJECT_DIR;
      else process.env.DESIGN_PROJECT_DIR = original;
    });

    it('accepts paths inside the project root', () => {
      expect(isWithinProjectDir('/home/user/app/design.manifest.md')).toBe(true);
      expect(isWithinProjectDir('/home/user/app/docs/design.manifest.md')).toBe(true);
    });
    it('rejects paths outside the project root', () => {
      expect(isWithinProjectDir('/etc/motd.md')).toBe(false);
      expect(isWithinProjectDir('/home/user/app/../other/x.md')).toBe(false);
      expect(isWithinProjectDir('/home/user/application/x.md')).toBe(false); // prefix-but-not-child
    });
  });

  describe('getDataDir', () => {
    beforeEach(() => {
      delete process.env.DATA_DIR;
    });

    it('defaults to apps/docs/static relative to the package', () => {
      const dir = getDataDir();
      expect(dir.endsWith('/apps/docs/static')).toBe(true);
    });

    it('honours DATA_DIR env override', () => {
      process.env.DATA_DIR = '/custom/data/dir';
      expect(getDataDir()).toBe('/custom/data/dir');
    });
  });

  describe('getTemplateDir / getRecipeDir / getTemplatePath / getCatalogPath', () => {
    it('returns absolute paths rooted in the monorepo', () => {
      expect(getTemplateDir()).toMatch(/\/packages\/docs-gen\/templates$/);
      expect(getRecipeDir()).toMatch(/\/apps\/docs\/src\/routes\/recipes$/);
      expect(getTemplatePath()).toMatch(/\/packages\/docs-gen\/templates\/llms-full-template\.md$/);
      expect(getCatalogPath()).toMatch(/\/mcp\/component-catalog\.json$/);
    });
  });

  describe('getComponentLlmPath', () => {
    it('resolves a valid slug to a path inside the data dir', () => {
      const p = getComponentLlmPath('primitives', 'button');
      expect(p).toMatch(/\/primitives\/button\/llm\.txt$/);
    });

    it('accepts multi-word hyphenated slugs', () => {
      const p = getComponentLlmPath('components', 'date-picker');
      expect(p).toMatch(/\/components\/date-picker\/llm\.txt$/);
    });

    it('rejects uppercase in the slug', () => {
      expect(() => getComponentLlmPath('primitives', 'Button')).toThrow(/Invalid component slug/);
    });

    it('rejects whitespace', () => {
      expect(() => getComponentLlmPath('primitives', 'bad slug')).toThrow(/Invalid component slug/);
    });

    it('rejects leading or trailing hyphens', () => {
      expect(() => getComponentLlmPath('primitives', '-bad')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('primitives', 'bad-')).toThrow(/Invalid component slug/);
    });

    it('rejects path traversal attempts', () => {
      // Any dotted segment fails the SAFE_SLUG regex first.
      expect(() => getComponentLlmPath('primitives', '..')).toThrow(/Invalid component slug/);
      expect(() => getComponentLlmPath('primitives', '../../../etc/passwd')).toThrow(
        /Invalid component slug/
      );
    });
  });
});
