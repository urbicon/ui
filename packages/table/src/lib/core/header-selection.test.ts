import { describe, expect, it } from 'vitest';
import { headerSelection } from './header-selection';

describe('headerSelection', () => {
  describe('not page-scoped (client mode, or a one-page server result)', () => {
    it('nothing selected — unchecked, offers select-all', () => {
      const s = headerSelection({
        pageScoped: false,
        pageComplete: false,
        someSelected: false,
        visibleCount: 20
      });
      expect(s).toEqual({
        checked: false,
        indeterminate: false,
        disabled: false,
        labelKey: 'selection.selectAllRows'
      });
    });

    it('partially selected — indeterminate, still offers select-all', () => {
      const s = headerSelection({
        pageScoped: false,
        pageComplete: false,
        someSelected: true,
        visibleCount: 20
      });
      expect(s.checked).toBe(false);
      expect(s.indeterminate).toBe(true);
      expect(s.labelKey).toBe('selection.selectAllRows');
    });

    it('everything selected — full check, offers deselect-all', () => {
      const s = headerSelection({
        pageScoped: false,
        pageComplete: true,
        someSelected: false,
        visibleCount: 20
      });
      expect(s.checked).toBe(true);
      expect(s.indeterminate).toBe(false);
      expect(s.labelKey).toBe('selection.deselectAllRows');
    });
  });

  describe('page-scoped (server mode, result larger than the page)', () => {
    it('nothing selected — offers the page, with its count', () => {
      const s = headerSelection({
        pageScoped: true,
        pageComplete: false,
        someSelected: false,
        visibleCount: 20
      });
      expect(s.checked).toBe(false);
      expect(s.indeterminate).toBe(false);
      expect(s.labelKey).toBe('selection.selectPageRows');
      expect(s.labelParams).toEqual({ count: 20 });
    });

    it('partially selected — mixed, still offers selecting the page', () => {
      const s = headerSelection({
        pageScoped: true,
        pageComplete: false,
        someSelected: true,
        visibleCount: 20
      });
      expect(s.checked).toBe(false);
      expect(s.indeterminate).toBe(true);
      expect(s.labelKey).toBe('selection.selectPageRows');
    });

    it('page complete — a full check stays unreachable; mixed, offers deselecting the page', () => {
      // "All 400" is never provable from one page, so the checkbox may not
      // claim it: aria-checked="mixed" is the honest maximum (#224).
      const s = headerSelection({
        pageScoped: true,
        pageComplete: true,
        someSelected: false,
        visibleCount: 20
      });
      expect(s.checked).toBe(false);
      expect(s.indeterminate).toBe(true);
      expect(s.labelKey).toBe('selection.deselectPageRows');
      expect(s.labelParams).toEqual({ count: 20 });
    });

    it('no visible rows — disabled instead of offering "the 0 rows", in both modes', () => {
      for (const pageScoped of [true, false]) {
        const s = headerSelection({
          pageScoped,
          pageComplete: false,
          someSelected: false,
          visibleCount: 0
        });
        expect(s.disabled).toBe(true);
        expect(s.checked).toBe(false);
        expect(s.indeterminate).toBe(false);
        expect(s.labelKey).toBe('selection.selectAllRows');
        expect(s.labelParams).toBeUndefined();
      }
    });

    it('a single visible row uses the singular keys', () => {
      expect(
        headerSelection({
          pageScoped: true,
          pageComplete: false,
          someSelected: false,
          visibleCount: 1
        }).labelKey
      ).toBe('selection.selectPageRow');
      expect(
        headerSelection({
          pageScoped: true,
          pageComplete: true,
          someSelected: false,
          visibleCount: 1
        }).labelKey
      ).toBe('selection.deselectPageRow');
    });
  });
});
