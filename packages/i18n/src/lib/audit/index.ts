/**
 * `@urbicon-ui/i18n/audit` — the dependency-free data-level audit (Feature A,
 * also on the main entry) plus the source-scanning unused-key detector
 * (Feature B). The scanner lazily imports `typescript` and `svelte/compiler`
 * (optional peers), so this subpath stays out of the i18n runtime entry and the
 * heavy deps load only when a scan actually runs.
 *
 * The CLI (`urbicon i18n`) is the filesystem front end over this pure core: it
 * globs sources, reads bundles, then calls `scanSources` + `findUnusedKeys` +
 * `auditTranslations` here.
 */

export type { I18nMissingKey, Locale } from '$lib/i18n/types';
export { isLocaleSupported, SUPPORTED_LOCALES } from '$lib/i18n/types';
// Re-exported so the CLI can derive defined keys from a bundle and validate
// locale tags without importing the main (Svelte-bearing) entry — keeps the node
// CLI free of Svelte runtime.
export { collectDeepKeys } from '$lib/utils/deep-keys';
export { makeGlobMatcher } from './glob';
export type { MissingKeyCollector, MissingKeyRecord } from './missing-key-collector';
export { createMissingKeyCollector } from './missing-key-collector';
export type { FindHardcodedOptions, HardcodedFinding } from './scan/hardcoded';
export { findHardcodedStrings } from './scan/hardcoded';
export type { ScanSourcesResult } from './scan/scanner';
// Usage scanner (Feature B) + hardcoded-string lint (Feature C).
export { scanSource, scanSources } from './scan/scanner';
export type { KeyUsageSite, ScanOptions, UsageScan } from './scan/types';
export type {
  AuditTranslationsOptions,
  TranslationAuditReport,
  TranslationFinding,
  TranslationFindingCode,
  TranslationFindingSeverity
} from './translations';
// Data-level translation audit (Feature A).
export { auditTranslations } from './translations';
export type {
  DynamicPrefixCoverage,
  FindUnusedOptions,
  UnusedKeyFinding,
  UnusedReport,
  UsedButUndefinedFinding
} from './unused';
export { findUnusedKeys } from './unused';
