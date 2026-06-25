/**
 * `auditTranslations` — data-level translation quality & parity audit.
 *
 * The richer successor to {@link validatePackageTranslations}: a pure function
 * over a package's locale bundles (no source scan, no I/O, deterministic, zero
 * false positives) that reports structured findings instead of opaque strings.
 *
 * Consumers run it in a vitest test to fail CI on drift —
 * `expect(auditTranslations('app', bundles).ok).toBe(true)` — or via the
 * `urbicon i18n parity` CLI, which formats the same findings. Key parity is the
 * baseline (missing/extra keys); on top of it sit the checks a structural diff
 * can't see: empty values, interpolation-param drift between locales, malformed
 * or CLDR-incomplete `_plural` objects, placeholder leftovers, and (opt-in)
 * not-yet-translated strings identical to the base locale.
 */

import type { Locale } from '$lib/i18n/types';
import { collectDeepKeys, getDeepValue } from '$lib/utils/deep-keys';

/** A single audit check. Stable identifiers — safe to switch on in tooling/CI. */
export type TranslationFindingCode =
  | 'missing-key'
  | 'extra-key'
  | 'empty-value'
  | 'param-mismatch'
  | 'plural-shape-invalid'
  | 'plural-category-incomplete'
  | 'value-equals-key'
  | 'same-as-base'
  | 'no-translations';

export type TranslationFindingSeverity = 'error' | 'warning';

export interface TranslationFinding {
  /** Which check produced this finding. */
  code: TranslationFindingCode;
  severity: TranslationFindingSeverity;
  /** The locale the finding belongs to (the base locale for base-only checks). */
  locale: Locale;
  /** Dotted leaf-key path, e.g. `dialog.close`. Empty for whole-bundle findings. */
  key: string;
  /** Human-readable message, prefixed with `[packageName]`. */
  detail: string;
}

export interface AuditTranslationsOptions {
  /** Base locale every other locale is diffed against. Default: `en` if present, else the first. */
  baseLocale?: Locale;
  /**
   * Per-check toggles. Unlisted checks keep their default — all on EXCEPT
   * `same-as-base`, which is FP-prone (brand names, "OK", shared tokens) and
   * opt-in. `missing-key` cannot be disabled (it is the parity floor).
   */
  checks?: Partial<Record<TranslationFindingCode, boolean>>;
  /** Leaf-key paths to skip across all checks. Exact, or a `prefix.*` glob. */
  ignoreKeys?: string[];
}

export interface TranslationAuditReport {
  /** True when there are no `error`-severity findings (warnings do not fail). */
  ok: boolean;
  /** All findings, sorted deterministically by locale → key → code. */
  findings: TranslationFinding[];
  /** The `error` subset, for a quick `expect(report.errors).toEqual([])`. */
  errors: TranslationFinding[];
  /** The `warning` subset. */
  warnings: TranslationFinding[];
}

/** Defaults: everything on except the FP-prone, opt-in `same-as-base`. */
const DEFAULT_CHECKS: Record<TranslationFindingCode, boolean> = {
  'missing-key': true,
  'extra-key': true,
  'empty-value': true,
  'param-mismatch': true,
  'plural-shape-invalid': true,
  'plural-category-incomplete': true,
  'value-equals-key': true,
  'same-as-base': false,
  'no-translations': true
};

/** Same `{{param}}` syntax the runtime interpolates (`registry.interpolate`). */
const PARAM_RE = /\{\{([^}]+)\}\}/g;

/** The interpolation params a template references, e.g. `Hello {{name}}` → `{name}`. */
function extractParamNames(template: string): Set<string> {
  const names = new Set<string>();
  for (const match of template.matchAll(PARAM_RE)) names.add(match[1].trim());
  return names;
}

/** Build an exact-or-`prefix.*` matcher; an empty/absent list matches nothing. */
function makeIgnoreMatcher(patterns: string[] | undefined): (key: string) => boolean {
  if (!patterns || patterns.length === 0) return () => false;
  const exact = new Set<string>();
  const prefixes: string[] = [];
  for (const pattern of patterns) {
    if (pattern.endsWith('*')) prefixes.push(pattern.slice(0, -1));
    else exact.add(pattern);
  }
  return (key) => exact.has(key) || prefixes.some((prefix) => key.startsWith(prefix));
}

/** CLDR cardinal categories required for `locale`, e.g. `en` → [one, other]. */
function requiredPluralCategories(locale: Locale): string[] {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

/** A leaf value is "translatable" (worth a same-as-base check) if it has a letter. */
function isTranslatable(value: string): boolean {
  return value.trim().length >= 2 && /\p{L}/u.test(value);
}

const LOCALE_ORDER = ['en', 'de', 'fr', 'es', 'it', 'nl'];
function localeRank(locale: string): number {
  const i = LOCALE_ORDER.indexOf(locale);
  return i === -1 ? LOCALE_ORDER.length : i;
}

/**
 * Audit a package's locale bundles for parity and translation-quality issues.
 *
 * @param packageName Used only to prefix `detail` messages (e.g. `[blocks]`).
 * @param translations Per-locale bundles, exactly as passed to `createPackageI18n`.
 */
export function auditTranslations(
  packageName: string,
  translations: Partial<Record<Locale, Record<string, unknown>>>,
  options: AuditTranslationsOptions = {}
): TranslationAuditReport {
  const checks = { ...DEFAULT_CHECKS, ...options.checks, 'missing-key': true };
  const isIgnored = makeIgnoreMatcher(options.ignoreKeys);
  const findings: TranslationFinding[] = [];
  const add = (
    code: TranslationFindingCode,
    severity: TranslationFindingSeverity,
    locale: Locale,
    key: string,
    message: string
  ) => {
    if (!checks[code]) return;
    findings.push({ code, severity, locale, key, detail: `[${packageName}] ${message}` });
  };

  const locales = Object.keys(translations) as Locale[];
  const baseLocale =
    options.baseLocale ?? (locales.includes('en') ? 'en' : locales[0]) ?? ('en' as Locale);
  const baseBundle = translations[baseLocale];

  if (!baseBundle || locales.length === 0) {
    add(
      'no-translations',
      'error',
      baseLocale,
      '',
      locales.length === 0
        ? 'no translations provided'
        : `base locale ${baseLocale} has no translations`
    );
    return finalize(findings);
  }

  const baseKeys = collectDeepKeys(baseBundle);
  const baseKeySet = new Set(baseKeys);
  const baseValueOf = (key: string): string | undefined => {
    const value = getDeepValue(baseBundle, key);
    return typeof value === 'string' ? value : undefined;
  };

  // Value-level checks run on EVERY locale (the base included — an empty or
  // malformed base entry is a defect regardless). Parity checks compare each
  // non-base locale against the base.
  for (const locale of locales) {
    const bundle = translations[locale];
    if (!bundle) continue;
    const keys = collectDeepKeys(bundle);
    const keySet = new Set(keys);

    for (const key of keys) {
      if (isIgnored(key)) continue;
      const value = getDeepValue(bundle, key);
      if (typeof value !== 'string') continue;

      if (value.trim() === '') {
        // A non-base hole over a non-empty base is a user-facing regression
        // (empty string renders); an empty base entry is merely suspicious.
        const baseHasContent = locale !== baseLocale && (baseValueOf(key) ?? '').trim() !== '';
        add(
          'empty-value',
          baseHasContent ? 'error' : 'warning',
          locale,
          key,
          `empty value at "${key}"`
        );
      }

      if (value === key) {
        add('value-equals-key', 'warning', locale, key, `value equals its key at "${key}"`);
      }

      if (key.endsWith('_plural')) {
        auditPluralValue(value, locale, key, add, checks);
      }
    }

    if (locale === baseLocale) continue;

    for (const key of baseKeys) {
      if (isIgnored(key)) continue;
      if (!keySet.has(key)) add('missing-key', 'error', locale, key, `missing key "${key}"`);
    }
    for (const key of keys) {
      if (isIgnored(key)) continue;
      if (!baseKeySet.has(key)) add('extra-key', 'warning', locale, key, `extra key "${key}"`);
    }

    // Param / same-as-base checks need the same leaf present (as a string) in both.
    for (const key of keys) {
      if (isIgnored(key) || !baseKeySet.has(key)) continue;
      const value = getDeepValue(bundle, key);
      const baseValue = baseValueOf(key);
      if (typeof value !== 'string' || baseValue === undefined) continue;

      const baseParams = extractParamNames(baseValue);
      const localeParams = extractParamNames(value);
      const missing = [...baseParams].filter((p) => !localeParams.has(p));
      const extra = [...localeParams].filter((p) => !baseParams.has(p));
      if (missing.length || extra.length) {
        const parts = [
          missing.length ? `missing {{${missing.join('}}, {{')}}}` : '',
          extra.length ? `unexpected {{${extra.join('}}, {{')}}}` : ''
        ].filter(Boolean);
        add('param-mismatch', 'error', locale, key, `param drift at "${key}": ${parts.join('; ')}`);
      }

      if (value === baseValue && isTranslatable(baseValue)) {
        add('same-as-base', 'warning', locale, key, `value identical to ${baseLocale} at "${key}"`);
      }
    }
  }

  return finalize(findings);
}

/** Parse a `<key>_plural` JSON object and flag malformed shape / missing CLDR forms. */
function auditPluralValue(
  value: string,
  locale: Locale,
  key: string,
  add: (
    code: TranslationFindingCode,
    severity: TranslationFindingSeverity,
    locale: Locale,
    key: string,
    message: string
  ) => void,
  checks: Record<TranslationFindingCode, boolean>
): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    add(
      'plural-shape-invalid',
      'error',
      locale,
      key,
      `_plural value at "${key}" is not valid JSON`
    );
    return;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    add('plural-shape-invalid', 'error', locale, key, `_plural value at "${key}" is not an object`);
    return;
  }
  const forms = parsed as Record<string, unknown>;
  if (typeof forms.other !== 'string') {
    add(
      'plural-shape-invalid',
      'error',
      locale,
      key,
      `_plural object at "${key}" lacks a string "other" form`
    );
    return;
  }
  if (!checks['plural-category-incomplete']) return;
  const missing = requiredPluralCategories(locale).filter((cat) => typeof forms[cat] !== 'string');
  if (missing.length) {
    add(
      'plural-category-incomplete',
      'warning',
      locale,
      key,
      `_plural object at "${key}" is missing CLDR form(s) for ${locale}: ${missing.join(', ')}`
    );
  }
}

/** Sort deterministically (locale → key → code) and split by severity. */
function finalize(findings: TranslationFinding[]): TranslationAuditReport {
  findings.sort(
    (a, b) =>
      localeRank(a.locale) - localeRank(b.locale) ||
      a.key.localeCompare(b.key) ||
      a.code.localeCompare(b.code)
  );
  const errors = findings.filter((f) => f.severity === 'error');
  const warnings = findings.filter((f) => f.severity === 'warning');
  return { ok: errors.length === 0, findings, errors, warnings };
}
