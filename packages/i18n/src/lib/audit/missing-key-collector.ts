/**
 * `createMissingKeyCollector` — a ready-made `onMissingKey` sink that records
 * every resolved-nowhere key so a test or E2E run can assert "no missing keys
 * were hit", or feed observed dynamic keys into the unused-key scanner.
 *
 * ```ts
 * const misses = createMissingKeyCollector();
 * configureI18n({ onMissingKey: misses.onMissingKey });
 * // … render / exercise the app …
 * expect(misses.report()).toEqual([]); // fail-loud on any raw-key render
 * ```
 *
 * This is the runtime counterpart to {@link auditTranslations}: the audit catches
 * keys missing *between bundles* statically; the collector catches keys a code
 * path actually *requested* but no bundle defined — including dynamically built
 * ones a static scan cannot see.
 */

import type { I18nMissingKey, Locale } from '$lib/i18n/types';

export interface MissingKeyRecord {
  /** The unresolved key. */
  key: string;
  /** Active locale when the miss occurred. */
  locale: Locale;
  /** Package scope, if the call was package-scoped. */
  packageName?: string;
  /** How many times this (key, locale, package) miss was observed. */
  count: number;
}

export interface MissingKeyCollector {
  /** Wire this into `configureI18n({ onMissingKey })`. */
  onMissingKey: (info: I18nMissingKey) => void;
  /** Distinct misses observed, sorted by key then locale, with hit counts. */
  report(): MissingKeyRecord[];
  /** Whether no miss has been observed (convenience for assertions). */
  isClean(): boolean;
  /** Forget everything observed so far (e.g. in a `beforeEach`). */
  reset(): void;
}

export function createMissingKeyCollector(): MissingKeyCollector {
  const records = new Map<string, MissingKeyRecord>();
  const idOf = (info: I18nMissingKey) => `${info.packageName ?? ''}::${info.locale}::${info.key}`;

  return {
    onMissingKey(info) {
      const id = idOf(info);
      const existing = records.get(id);
      if (existing) {
        existing.count += 1;
        return;
      }
      records.set(id, {
        key: info.key,
        locale: info.locale,
        packageName: info.packageName,
        count: 1
      });
    },
    report() {
      return [...records.values()].sort(
        (a, b) => a.key.localeCompare(b.key) || a.locale.localeCompare(b.locale)
      );
    },
    isClean() {
      return records.size === 0;
    },
    reset() {
      records.clear();
    }
  };
}
