// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CalendarLocaleHarness from './__fixtures__/CalendarLocaleHarness.svelte';

// The locale fallback chain: explicit prop → <I18nProvider> → base locale.
//
// Until 2026-07-31 every date component defaulted to the literal `'de-DE'`, so an English app
// rendered German month names unless it passed `locale` to each one by hand — the i18n provider
// governed translated strings but had no connection to `Intl` formatting. These tests pin the three
// rungs of the chain so the default cannot silently drift back to one language.
//
// Asserted on the header title, which is the shortest observable path from the resolved locale to
// the DOM (Calendar renders `formatMonthYear(year, month, locale)` there). Month names are matched
// by regex on the language-distinguishing part rather than by exact string, so the assertions
// survive an ICU data change that re-punctuates the title.
//
// `defaultMonth`/`defaultYear` pin the rendered month, so the test does not depend on the date it
// runs. March is chosen because its name differs across the three locales under test
// (März / March / mars) while being short enough to avoid abbreviation.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mountCalendar(props: Record<string, unknown>) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(CalendarLocaleHarness, {
    target,
    props: { defaultMonth: 2, defaultYear: 2026, ...props }
  });
  flushSync();
  dispose = () => {
    unmount(component);
    target.remove();
  };
  return target;
}

/** The header title is a button; return its text regardless of surrounding chrome. */
function headerTitle(): string {
  const heading = screen.getByRole('button', { name: /2026/ });
  return heading.textContent ?? '';
}

describe('Calendar locale resolution', () => {
  it('falls back to the base locale (en) when no provider is mounted', () => {
    mountCalendar({});
    // The regression this guards: it used to read "März 2026" here, in an app that never
    // declared German anywhere.
    expect(headerTitle()).toMatch(/March/);
    expect(headerTitle()).not.toMatch(/März/);
  });

  it('follows the provider locale', () => {
    mountCalendar({ initialLocale: 'de' });
    expect(headerTitle()).toMatch(/März/);
  });

  // Deliberately French, not German: `de` was the old hardcoded default, so a `de` provider test
  // stays green even against an implementation that ignores the provider entirely (verified — it
  // does). A third language is the only assertion that actually proves the context is read.
  it('follows a provider locale that was never the default', () => {
    mountCalendar({ initialLocale: 'fr' });
    const title = headerTitle();
    expect(title).toMatch(/mars/i);
    expect(title).not.toMatch(/März|March/);
  });

  it('lets an explicit locale prop win over the provider', () => {
    mountCalendar({ initialLocale: 'de', locale: 'fr-FR' });
    const title = headerTitle();
    expect(title).toMatch(/mars/i);
    expect(title).not.toMatch(/März/);
  });

  it('honours an explicit locale with no provider present', () => {
    mountCalendar({ locale: 'de-DE' });
    expect(headerTitle()).toMatch(/März/);
  });
});
