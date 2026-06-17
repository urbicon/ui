import { validatePackageTranslations } from '@urbicon-ui/i18n';
import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

/**
 * CI gate: the shipped en/de bundles must carry the same deep-key set. The
 * optional (`?`) fields in AuthLocale exist so a *consumer-registered* locale
 * may ship a subset — but the bundles WE ship are expected to be complete and
 * symmetric, so this asserts exact parity (both errors AND warnings empty).
 * Adding a deliberately-partial third locale would relax this for that locale.
 */
describe('auth translations — en/de deep-key parity', () => {
  it('en and de carry identical nested keys', () => {
    const { errors, warnings } = validatePackageTranslations('auth', { en, de });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
