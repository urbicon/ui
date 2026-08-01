// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CalendarLocaleHarness from './__fixtures__/CalendarLocaleHarness.svelte';

// The calendar's width used to follow its month name: the header title is the
// widest thing in the box, so paging March → September dragged the day grid
// along (212 → 268 px in de-DE, a step on every month change).
//
// The header now lays all twelve titles of the ACTIVE locale in one grid cell
// and shows one, so the cell holds the width of the longest. jsdom does no
// layout, so these tests assert the mechanism — that the reservation exists,
// carries the right locale, and covers every month — rather than pixel widths.
// The pixel half is what the VR baselines cover.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mountCalendar(props: Record<string, unknown>): HTMLElement {
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

/** The title button — the one that opens the month/year quick-pick. */
function titleButton(target: HTMLElement): HTMLElement {
  const button = target.querySelector<HTMLElement>('button[aria-haspopup="dialog"]');
  if (!button) throw new Error('header title button not found');
  return button;
}

/** The hidden width reservations — everything but the one visible title. */
function reservations(target: HTMLElement): string[] {
  return [...titleButton(target).querySelectorAll('span.invisible')].map((el) =>
    (el.textContent ?? '').trim()
  );
}

describe('CalendarHeader month-name width reservation', () => {
  it('reserves all twelve month names of the displayed year', () => {
    const target = mountCalendar({ locale: 'en-US' });
    const reserved = reservations(target);
    expect(reserved).toHaveLength(12);
    // Every reservation carries the displayed year, so the year part of the
    // title is inside the reserved box too — not just the month name.
    expect(reserved.every((label) => label.includes('2026'))).toBe(true);
    expect(reserved).toContain('March 2026');
    expect(reserved).toContain('September 2026');
  });

  it('reserves in the active locale, not a fixed one', () => {
    const target = mountCalendar({ locale: 'de-DE' });
    const reserved = reservations(target);
    expect(reserved).toContain('März 2026');
    // The point of the reservation: in de-DE the longest name is not the one
    // en-US would have reserved.
    expect(reserved).toContain('September 2026');
    expect(reserved.some((label) => label.includes('March'))).toBe(false);
  });

  it('follows the calendar to a new year', () => {
    const target = mountCalendar({ locale: 'en-US', defaultYear: 2031 });
    expect(reservations(target).every((label) => label.includes('2031'))).toBe(true);
  });

  it('keeps the reservations out of the accessible name', () => {
    const target = mountCalendar({ locale: 'en-US' });
    // `visibility: hidden` already removes them from the a11y tree; what must
    // hold regardless is that exactly one of the thirteen stacked cells is the
    // visible one, so the button never reads as twelve month names in a row.
    const stack = titleButton(target).querySelector('span.grid');
    const cells = [...(stack?.children ?? [])];
    expect(cells).toHaveLength(13);
    const visible = cells.filter((el) => !el.classList.contains('invisible'));
    expect(visible).toHaveLength(1);
    expect(visible[0].textContent?.trim()).toBe('March 2026');
  });

  it('does not reserve month widths in the week view', () => {
    // A week title carries day numbers that vary on their own, so there is no
    // fixed set of twelve to reserve for.
    const target = mountCalendar({ locale: 'en-US', view: 'week' });
    expect(reservations(target)).toHaveLength(0);
  });
});
