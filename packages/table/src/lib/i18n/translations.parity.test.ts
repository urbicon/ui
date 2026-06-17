import { validatePackageTranslations } from '@urbicon-ui/i18n';
import { describe, expect, it } from 'vitest';
import de from '../translations/de';
import en from '../translations/en';

/**
 * CI gate: every locale bundle must carry the same deep-key set as `en`. A
 * missing or misspelled nested key in `de` fails the build here.
 */
describe('table translations — en/de deep-key parity', () => {
  it('en and de carry identical nested keys', () => {
    const { errors, warnings } = validatePackageTranslations('table', { en, de });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });
});
