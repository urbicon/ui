// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import DatePickerLocaleHarness from './__fixtures__/DatePickerLocaleHarness.svelte';

/**
 * The locale chain for the two pickers, asserted through the **input mask** —
 * which is where it bites hardest and where the rest of the suite cannot see it.
 *
 * Every other DatePicker/DateRangePicker test pins `locale="de-DE"` in its mount
 * helper (correctly: they are about mask parsing and range mechanics, not about
 * which locale). The consequence is that removing the resolution entirely leaves
 * those 76 tests green — measured. These cases are the net for the `'auto'` path
 * itself.
 *
 * They also pin the half of the 2026-07-31 default change that is easy to
 * understate. It is not only month names: the locale drives the display mask AND
 * the parser, so a German app that relied on the old `'de-DE'` default sees
 * `15.03.2026` become `3/15/2026`, and typing `15.03.2026` stops parsing (the
 * only locale-independent input is ISO `YYYY-MM-DD`). Anyone changing the
 * default again should have to walk past these.
 */

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderPicker(props: Record<string, unknown>) {
  const instance = mount(DatePickerLocaleHarness, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

/** The picker's text input — the mask is whatever it displays. */
const input = () => screen.getByRole('textbox') as HTMLInputElement;

const MARCH_15 = new Date(2026, 2, 15);

describe('DatePicker locale resolution', () => {
  it('falls back to the base locale (en) with no provider and no prop', () => {
    renderPicker({ value: MARCH_15 });
    // en → M/D/YYYY. Before 2026-07-31 this read "15.3.2026" in an app that
    // never declared German anywhere.
    expect(input().value).toMatch(/3.15.2026/);
  });

  it('follows a provider locale that was never the default', () => {
    // French, not German, for the same reason as in Calendar.locale: `de` was the
    // old hardcoded default, so a `de` provider case stays green against an
    // implementation that ignores the provider entirely.
    renderPicker({ value: MARCH_15, initialLocale: 'fr' });
    expect(input().value).toMatch(/15.03.2026/);
  });

  it('lets an explicit prop win over the provider', () => {
    renderPicker({ value: MARCH_15, initialLocale: 'fr', locale: 'en-GB' });
    expect(input().value).toMatch(/15.03.2026/);
  });

  it('parses typed input in the resolved locale, not a fixed one', async () => {
    // The consequential half: with `en` resolved, "15.03.2026" is not a date.
    const user = userEvent.setup();
    renderPicker({});
    await user.click(input());
    await user.keyboard('3/15/2026');
    await user.tab();
    flushSync();
    expect(input().value).toMatch(/3.15.2026/);
    expect(document.body.textContent).not.toContain('Invalid date');
  });

  it('resolves a malformed provider locale instead of throwing', () => {
    // `I18nState`'s constructor does not validate, so `'de_DE'` reaches Intl and
    // throws RangeError — a render-time throw, i.e. an SSR 500, in a component
    // that never saw the value. The guard in resolve-date-locale.ts turns that
    // into a base-locale render plus a DEV warning.
    expect(() => renderPicker({ value: MARCH_15, initialLocale: 'de_DE' as never })).not.toThrow();
    expect(input().value).toMatch(/3.15.2026/);
  });
});

describe('DateRangePicker locale resolution', () => {
  const range = { start: MARCH_15, end: new Date(2026, 2, 22) };

  it('falls back to the base locale (en) with no provider and no prop', () => {
    renderPicker({ which: 'range', value: range });
    expect(input().value).toMatch(/3.15.2026/);
  });

  it('follows a provider locale that was never the default', () => {
    renderPicker({ which: 'range', value: range, initialLocale: 'fr' });
    expect(input().value).toMatch(/15.03.2026/);
  });

  it('lets an explicit prop win over the provider', () => {
    renderPicker({ which: 'range', value: range, initialLocale: 'fr', locale: 'en-GB' });
    expect(input().value).toMatch(/15.03.2026/);
  });
});
