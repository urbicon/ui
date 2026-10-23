import { auditTranslations, collectDeepKeys } from '@urbicon-ui/i18n/audit';
import { describe, expect, it } from 'vitest';
import de from '../translations/de';
import en from '../translations/en';

/**
 * CI gate: the app's `de` bundle passes the translation audit against `en`.
 *
 * `appI18n` (`./index.ts`) types `de` against `en`, so a key missing from `de`
 * is a compile error; an extra key, an empty value or a dropped `{{param}}` is
 * not, and this test reports them.
 *
 * It takes the bundles, not `auditPackage(appI18n)`: the app's vitest config is
 * plain node without the Svelte plugin (by design — instant, kit-churn-proof),
 * and `appI18n` comes from the package root, which re-exports `.svelte`
 * components this pipeline cannot parse. The Svelte-free `/audit` subpath loads.
 */
describe('docs-app translations — audit against the en base', () => {
  it('reports no findings', () => {
    expect(auditTranslations('app', { en, de }).findings).toEqual([]);
  });

  it('the gate sees a real bundle (guard against an accidentally-empty import)', () => {
    expect(collectDeepKeys(en).length).toBeGreaterThan(50);
  });
});
