import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import LocaleHarness from './__fixtures__/LocaleHarness.svelte';

/**
 * Which locale the formatting cells hand to `Intl`.
 *
 * Rendered through `svelte/server`, because the prerendered HTML is the half
 * that diverged: `Intl.DateTimeFormat(undefined, …)` follows the *runtime*
 * locale — the Node/Bun process on the server, the user's browser after
 * hydration — so one cell read `3/12/2026` in the server output and
 * `12.03.2026` in the client tree.
 *
 * The assertions go through an `<I18nProvider>`, and that is what makes them
 * machine-independent. The runtime locale is not a constant to test against:
 * this suite runs under Node, whose ICU default follows `LANG` (measured —
 * `de-DE` on the machine this was written on, `en-US` on a CI runner), while
 * `bun -e` pins `en-US` regardless of `LANG`. So "does the default match what
 * `Intl` does with `undefined`" is a question with a different answer on every
 * host, and on half of them the buggy and fixed code agree.
 *
 * Under a provider they cannot agree anywhere: the fix formats the declared
 * language, the old `undefined` formats whatever the host says. Which of the
 * assertions below goes red on the old code therefore varies by host — that
 * all of them cannot be green does not.
 */

const dateUnder = (locale?: 'de' | 'en', cellLocale?: string) =>
  render(LocaleHarness, { props: { cell: 'date' as const, locale, cellLocale } }).body;

const numberUnder = (locale?: 'de' | 'en', cellLocale?: string) =>
  render(LocaleHarness, { props: { cell: 'number' as const, locale, cellLocale } }).body;

describe('DateCell locale', () => {
  it('follows the provider locale', () => {
    // The regression test proper. With `locale = undefined` this rendered
    // "Mar 12, 2026" — the runtime's answer, not the app's declared language.
    expect(dateUnder('de')).toContain('12.03.2026');
  });

  it('formats the same date differently per provider locale', () => {
    // Stated as a difference so a future change that pins one locale for
    // everyone fails here rather than passing half the suite.
    expect(dateUnder('de')).not.toBe(dateUnder('en'));
    expect(dateUnder('en')).toContain('Mar 12, 2026');
  });

  it('falls back to the base locale with no provider mounted', () => {
    // `useI18n()` is read-tolerant, so a page without `<I18nProvider>` still
    // formats identically on both sides of hydration.
    expect(dateUnder(undefined)).toContain('Mar 12, 2026');
  });

  it('an explicit prop beats the provider, including a locale we do not translate', () => {
    const body = dateUnder('de', 'ja-JP');
    expect(body).toContain('2026/03/12');
  });

  it('the title tooltip follows the same locale as the cell text', () => {
    // A second `Intl` call site inside the component, and one the original
    // sweep for #3 missed precisely because it is an attribute, not text.
    const body = dateUnder('de');
    expect(body).toMatch(/title="[^"]*März[^"]*"/);
  });
});

describe('NumberCell locale', () => {
  it('follows the provider locale instead of the hardcoded de-DE', () => {
    // This one was wrong on every machine, not just across the SSR boundary:
    // `locale = 'de-DE'` meant an English app rendered "1.234,56".
    expect(numberUnder('en')).toContain('1,234.56');
    expect(numberUnder('de')).toContain('1.234,56');
  });

  it('falls back to the base locale with no provider mounted', () => {
    expect(numberUnder(undefined)).toContain('1,234.56');
  });

  it('an explicit prop beats the provider', () => {
    expect(numberUnder('en', 'de-DE')).toContain('1.234,56');
  });
});
