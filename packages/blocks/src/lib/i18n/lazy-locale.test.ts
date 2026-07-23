import { describe, expect, it } from 'vitest';
import de from '../translations/de';
import { blocksI18n, blocksTranslations, getBlocksLocales, registerBlocksLocale } from './index';

/**
 * blocks i18n is split: the English base bundle is eager, German (`de`) is a lazy
 * dynamic-import loader so English-only apps never bundle the `de` catalog.
 *
 * This suite runs in the node env (no DOM) and asserts the **blocks wiring**: en
 * is immediately resolvable, `de` is a declared-but-lazy locale (only its loader
 * is eager, not its data), and the `registerBlocksLocale` SSR escape hatch is
 * wired + strict. The string-level "resolves to the fallback before load, to its
 * own bundle after (load or eager register)" semantics are proven directly
 * against the registry in `@urbicon-ui/i18n`'s `lazy-load.test.ts` (which has the
 * registry access this package-level surface deliberately does not expose).
 */
describe('blocks i18n — en eager, de lazy', () => {
  it('resolves the English base bundle synchronously (no await, no chunk)', () => {
    // en is eager: available on the very first call, no loader involved.
    expect(blocksI18n.t('accessibility.loading')).toBe('Loading');
  });

  it('declares de as a lazy locale (loader registered) while keeping it out of the eager base', () => {
    // The loader is registered eagerly, so de is a *known* locale...
    expect(getBlocksLocales().sort()).toEqual(['de', 'en']);
    // ...but the eager base object no longer carries the de data (that is the
    // tree-shaking win: en-only apps don't statically bundle de).
    expect(Object.keys(blocksTranslations)).toEqual(['en']);
  });
});

describe('registerBlocksLocale — SSR eager escape hatch', () => {
  it('accepts the real de bundle, additively and idempotently', () => {
    expect(() => registerBlocksLocale('de', de)).not.toThrow();
    // Idempotent, and the eager base (en) is never dropped by the merge.
    expect(() => registerBlocksLocale('de', de)).not.toThrow();
    expect(getBlocksLocales().sort()).toEqual(['de', 'en']);
    expect(blocksI18n.t('accessibility.loading')).toBe('Loading');
  });

  it('is write-strict: throws on an unsupported locale or a non-object bundle', () => {
    // @ts-expect-error deliberately invalid locale
    expect(() => registerBlocksLocale('xx', de)).toThrow(/unsupported locale/);
    // @ts-expect-error deliberately invalid bundle
    expect(() => registerBlocksLocale('de', null)).toThrow(/must be a translations object/);
  });
});
