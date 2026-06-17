import { validatePackageTranslations } from '@urbicon-ui/i18n';
import { describe, expect, it } from 'vitest';
import de from '../translations/de';
import en from '../translations/en';

/**
 * CI gate: every locale bundle must carry the same deep-key set as `en`. A
 * missing or misspelled nested key in `de` fails the build here. Complements the
 * compile-time parity the generic `createPackageI18n` already enforces — this
 * also catches drift in data that isn't checked through the typed factory.
 */
describe('blocks translations — en/de deep-key parity', () => {
  it('en and de carry identical nested keys', () => {
    const { errors, warnings } = validatePackageTranslations('blocks', { en, de });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
