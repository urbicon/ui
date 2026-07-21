import { describe, expect, it } from 'vitest';
import de from '../translations/de';
import en from '../translations/en';

/**
 * CI gate: the app's `de` bundle must carry the same deep-key set as `en`.
 *
 * `en.ts` is the type source of truth (`AppTranslationKey = DeepKeys<typeof
 * en>`), but `de.ts` is an unconstrained object — a key present in `en` and
 * missing from `de` fails neither `check` nor any type. That is exactly how
 * the three Auth nav groups sat un-localized in the German sidebar until
 * 2026-07-14. `packages/docs` has carried this gate since
 * (`translations.parity.test.ts` there); this mirrors it for the app.
 *
 * Deliberately NOT `validatePackageTranslations` from `@urbicon-ui/i18n`: the
 * app's vitest config is plain node without the Svelte plugin (by design —
 * instant, kit-churn-proof), and that helper's module graph pulls runes
 * modules and, via the package root, `.svelte` components neither of which
 * this pipeline can transform. The walk below replicates the library's
 * `collectDeepKeys` semantics — leaf paths, and an empty nested object still
 * occupies its key path so structural divergence is caught.
 */
function collectDeepKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const entries = Object.entries(obj);
  if (entries.length === 0) return prefix ? [prefix] : [];
  const out: string[] = [];
  for (const [key, value] of entries) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...collectDeepKeys(value as Record<string, unknown>, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe('docs-app translations — en/de deep-key parity', () => {
  const enKeys = collectDeepKeys(en);
  const deKeys = new Set(collectDeepKeys(de));
  const enKeySet = new Set(enKeys);

  it('de carries every key en defines (missing keys render English chrome)', () => {
    expect(enKeys.filter((key) => !deKeys.has(key))).toEqual([]);
  });

  it('de carries no keys en lacks (extra keys are dead weight or typos)', () => {
    expect([...deKeys].filter((key) => !enKeySet.has(key))).toEqual([]);
  });

  it('the gate sees a real bundle (guard against an accidentally-empty import)', () => {
    expect(enKeys.length).toBeGreaterThan(50);
  });
});
