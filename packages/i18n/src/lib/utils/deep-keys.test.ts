import { describe, expect, it } from 'vitest';
import { collectDeepKeys, getDeepValue, hasDeepKey } from './deep-keys';

describe('locale / translation key resolution (getDeepValue)', () => {
  it('resolves top-level keys', () => {
    const translations = { greeting: 'Hello', count: 42 };
    expect(getDeepValue(translations, 'greeting')).toBe('Hello');
    expect(getDeepValue(translations, 'count')).toBe(42);
  });

  it('resolves nested keys', () => {
    const translations = {
      common: { save: 'Speichern', cancel: 'Abbrechen' },
      form: { label: { required: 'Pflichtfeld' } }
    };
    expect(getDeepValue(translations, 'common.save')).toBe('Speichern');
    expect(getDeepValue(translations, 'form.label.required')).toBe('Pflichtfeld');
  });

  it('returns undefined for missing keys', () => {
    const translations = { a: { b: 1 } };
    expect(getDeepValue(translations, 'a.c')).toBeUndefined();
    expect(getDeepValue(translations, 'x')).toBeUndefined();
  });

  it('returns undefined for invalid paths', () => {
    const translations = { a: 1 };
    expect(getDeepValue(translations, 'a.b')).toBeUndefined();
  });
});

describe('hasDeepKey', () => {
  it('returns true for existing keys', () => {
    const obj = { common: { save: 'Save' } };
    expect(hasDeepKey(obj, 'common')).toBe(true);
    expect(hasDeepKey(obj, 'common.save')).toBe(true);
  });

  it('returns false for missing keys', () => {
    const obj = { a: { b: 1 } };
    expect(hasDeepKey(obj, 'a.c')).toBe(false);
    expect(hasDeepKey(obj, 'x')).toBe(false);
  });
});

describe('collectDeepKeys', () => {
  it('collects dotted leaf-key paths from a nested object', () => {
    const obj = {
      common: { save: 'Save', cancel: 'Cancel' },
      form: { label: { required: 'Required' } }
    };
    expect(collectDeepKeys(obj).sort()).toEqual(
      ['common.cancel', 'common.save', 'form.label.required'].sort()
    );
  });

  it('treats top-level leaves as bare keys', () => {
    expect(collectDeepKeys({ a: 'x', b: 'y' }).sort()).toEqual(['a', 'b']);
  });

  it('stops at non-object leaves (arrays count as a leaf)', () => {
    expect(collectDeepKeys({ list: ['a', 'b'], n: 1 }).sort()).toEqual(['list', 'n']);
  });

  it('returns an empty array for an empty root object', () => {
    expect(collectDeepKeys({})).toEqual([]);
  });

  it('emits an empty NESTED object as its own key path (not silently dropped)', () => {
    // `{ a: {} }` must not collapse to `[]`, else a structural divergence like
    // `{a:{}}` vs `{a:'x'}` would pass parity undetected.
    expect(collectDeepKeys({ a: {}, b: 'x' }).sort()).toEqual(['a', 'b']);
  });
});
