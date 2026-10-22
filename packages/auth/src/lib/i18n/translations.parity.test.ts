import { auditTranslations } from '@urbicon-ui/i18n';
import { describe, expect, it } from 'vitest';
import { de } from './de';
import { en } from './en';

/**
 * CI gate: the shipped en/de bundles must carry the same deep-key set. Since
 * review R19 the compiler already forces completeness (`AuthLocale` is fully
 * required and both bundles are `satisfies AuthLocale`; consumer subsets enter
 * as `PartialAuthLocale` through `mergeAuthLocale` instead) — this test stays
 * as the guard that survives someone loosening or dropping the `satisfies`.
 * Auth keeps its own locale registry, not a `createPackageI18n` package, so it
 * calls the audit directly; `en` is its base.
 */
describe('auth translations — audit against the en base', () => {
  it('reports no findings', () => {
    expect(auditTranslations('auth', { en, de }).findings).toEqual([]);
  });
});

describe('placeholder contracts', () => {
  // Key STRUCTURE is compiler-enforced since R19, but placeholder CONTENT is
  // not: a translator dropping `{n}` from de.ts yields "Mindestens Zeichen"
  // with zero signal (package-5 test review). Pin every substituted token.
  it.each([['en', en] as const, ['de', de] as const])(
    '%s carries the {n} tokens the components substitute',
    (_name, bundle) => {
      expect(bundle.auth.passwordRequirements.rules.minLength).toContain('{n}');
      expect(bundle.auth.passwordRequirements.failed).toContain('{rules}');
      expect(bundle.notifications.badge.unread).toContain('{n}');
      expect(bundle.common.timeAgo.minutes).toContain('{n}');
      expect(bundle.common.timeAgo.hours).toContain('{n}');
      expect(bundle.common.timeAgo.days).toContain('{n}');
    }
  );

  it.each([['en', en] as const, ['de', de] as const])(
    '%s email templates keep the builder placeholders',
    (_name, bundle) => {
      // {appName} appears in every subject; the change-notice body carries {email}.
      for (const mail of Object.values(bundle.auth.emails)) {
        expect(mail.subject).toContain('{appName}');
      }
      expect(bundle.auth.emails.changeEmailNotice.body).toContain('{email}');
    }
  );
});
