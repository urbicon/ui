import { validatePackageTranslations } from '@urbicon-ui/i18n';
import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

/**
 * CI gate: the shipped en/de bundles must carry the same deep-key set. Since
 * review R19 the compiler already forces completeness (`AuthLocale` is fully
 * required and both bundles are `satisfies AuthLocale`; consumer subsets enter
 * as `PartialAuthLocale` through `mergeAuthLocale` instead) — this test stays
 * as the guard that survives someone loosening or dropping the `satisfies`.
 */
describe('auth translations — en/de deep-key parity', () => {
  it('en and de carry identical nested keys', () => {
    const { errors, warnings } = validatePackageTranslations('auth', { en, de });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
