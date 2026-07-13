// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { getWeekdayNames } from '../../date';
import CalendarWeekdayHeaderHarness from './__fixtures__/CalendarWeekdayHeaderHarness.svelte';

// Regression net for the weekday-header each_key_duplicate crash. CalendarWeekdayHeader
// keyed its {#each} on the weekday label itself; narrow weekday names repeat in many
// locales (de-DE: M, D, M, D, F, S, S), so a bare-name key threw each_key_duplicate on
// every dev-mode client render — Svelte throws in DEV the moment a keyed each sees a
// duplicate. Same bug class and fix as CalendarMiniMonth (05d0e7c): the key now carries
// the column position (`${i}-${day}`), which stays unique whatever the labels are.
//
// The live header renders the 'short' format (unique in every locale), so the crash is
// only reachable when `weekdays` carries duplicates — the harness injects them through a
// minimal Calendar context. Test stack per repo conventions: svelte's own mount/unmount,
// @testing-library/dom queries, native vitest matchers (no jest-dom).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderHeader(weekdays: string[], showWeekNumbers = false) {
  const instance = mount(CalendarWeekdayHeaderHarness, {
    target: document.body,
    props: { weekdays, showWeekNumbers }
  });
  dispose = () => unmount(instance);
  flushSync();
}

// Locales whose *narrow* weekday names collide — the exact condition that crashed the
// header. Derived from the same getWeekdayNames() the library ships, so the fixtures
// track real ICU data rather than a hand-copied guess.
const DUPLICATE_LOCALES = ['de-DE', 'en-US', 'fr-FR', 'pt-BR'] as const;

describe('CalendarWeekdayHeader — duplicate weekday labels', () => {
  it('renders all 7 columns from a hard-coded duplicate narrow array without crashing', () => {
    const weekdays = ['M', 'D', 'M', 'D', 'F', 'S', 'S']; // de-DE narrow, ICU-independent
    // Precondition: the array must actually contain duplicates, else the case is vacuous.
    expect(new Set(weekdays).size).toBeLessThan(weekdays.length);

    // Before the fix this threw each_key_duplicate at mount; the position key fixes it.
    expect(() => renderHeader(weekdays)).not.toThrow();

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    // All seven labels render in order, duplicates and all.
    expect(headers.map((el) => el.textContent?.trim())).toEqual(weekdays);
  });

  it.each(DUPLICATE_LOCALES)('renders 7 columns for %s narrow weekday names', (locale) => {
    const weekdays = getWeekdayNames(locale, 1, 'narrow');
    // The whole point of the case is a duplicate-bearing array. If some runtime's ICU
    // ever de-duplicates these, fail loud rather than pass a hollow assertion.
    expect(new Set(weekdays).size).toBeLessThan(weekdays.length);

    expect(() => renderHeader(weekdays)).not.toThrow();

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(7);
    expect(headers.map((el) => el.textContent?.trim())).toEqual(weekdays);
  });

  it('adds exactly one week-number columnheader when showWeekNumbers is set', () => {
    const weekdays = ['M', 'D', 'M', 'D', 'F', 'S', 'S'];

    expect(() => renderHeader(weekdays, true)).not.toThrow();

    // One leading (empty) week-number header + the 7 weekday cells.
    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(8);

    const withText = headers.filter((el) => (el.textContent?.trim() ?? '') !== '');
    expect(withText).toHaveLength(7);
    expect(withText.map((el) => el.textContent?.trim())).toEqual(weekdays);
  });
});
