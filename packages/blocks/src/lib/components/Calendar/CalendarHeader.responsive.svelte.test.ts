// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { registerBlocksLocale } from '$lib/i18n';
import deTranslations from '$lib/translations/de';
import CalendarLocaleHarness from './__fixtures__/CalendarLocaleHarness.svelte';

// `de` ships as a lazy chunk, so a provider alone resolves to the English base
// until it lands — the documented SSR recipe, and the only way to assert German
// strings synchronously here.
registerBlocksLocale('de', deTranslations);

// The header's overflow contract. Its natural width at `md` is ~543 px — nav +
// month title + the five-view switcher + today/next — so on a 390 px phone it
// used to push the DOCUMENT sideways (measured 575 px wide against a 390 px
// viewport, the whole docs page scrolling horizontally), because nothing in the
// row could wrap and nothing clipped it.
//
// Two mechanisms answer that, and both are structural rather than pixel-based,
// which is what makes them testable here: the header wraps, and each control
// group is its own wrap unit; below `sm` the view labels condense to their
// short form while the accessible name stays the full one. jsdom does no
// layout, so these tests assert the mechanism — the wrap units exist, both
// label forms are rendered, the accessible name never degrades. The pixel half
// is what the VR baselines cover.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
});

function mountCalendar(props: Record<string, unknown> = {}): HTMLElement {
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

/**
 * The header row itself — the element carrying the wrap contract. Found via the
 * previous-month button rather than the switcher, which `showViewSwitcher`
 * removes: nav wrapper → header.
 */
function header(target: HTMLElement): HTMLElement {
  const el = target.querySelector<HTMLElement>('button[aria-label]')?.parentElement?.parentElement;
  if (!el) throw new Error('calendar header not found');
  return el;
}

describe('CalendarHeader overflow contract', () => {
  it('lets the header wrap instead of widening past its container', () => {
    const target = mountCalendar();
    expect(header(target).className).toContain('flex-wrap');
  });

  it('keeps switcher and actions as separate wrap units', () => {
    // One cluster holding switcher + today + next could only wrap as a block,
    // and a line too narrow for all three would squeeze the switcher into
    // SegmentGroup's collapsed vertical fallback instead of dropping the two
    // buttons to a line of their own.
    const withSwitcher = header(mountCalendar());
    const groups = [...withSwitcher.children];
    expect(groups).toHaveLength(4); // nav · title · switcher · actions
    expect(groups[2].getAttribute('role')).toBe('radiogroup');
    expect(groups[3].querySelectorAll('button')).toHaveLength(2); // today · next
    dispose?.();

    const withoutSwitcher = header(mountCalendar({ showViewSwitcher: false }));
    expect(withoutSwitcher.children).toHaveLength(3);
  });
});

describe('CalendarHeader view labels', () => {
  it('renders both label forms so the narrow one is a pure CSS swap', () => {
    mountCalendar({ locale: 'de-DE', initialLocale: 'de' });
    const month = screen.getAllByRole('radio')[0];
    const spans = [...month.querySelectorAll('span')];
    expect(spans.map((s) => s.textContent)).toEqual(['Monat', 'M']);
    // Exactly one of the two is hidden at any width, and which one is decided
    // by CSS alone — no resize observer, no JS branch.
    expect(spans[0].className).toContain('max-sm:hidden');
    expect(spans[1].className).toContain('hidden');
    expect(spans[1].className).toContain('max-sm:inline');
    expect(spans[1].getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the full label as the accessible name', () => {
    // The visual fallback to a single letter must never reach a screen reader —
    // and before the switcher had `aria-label` at all, `size="sm"` announced
    // the bare letter.
    mountCalendar({ locale: 'de-DE', initialLocale: 'de' });
    expect(screen.getAllByRole('radio').map((el) => el.getAttribute('aria-label'))).toEqual([
      'Monat',
      'Woche',
      'Tag',
      'Jahr',
      'Liste'
    ]);
  });

  it('translates the short labels instead of shipping German initials', () => {
    // The regression: the short forms were hardcoded 'M','W','T','J','A' — the
    // initials of Monat/Woche/Tag/Jahr, so an English calendar offered "T" for
    // Day and "J" for Year. They are on screen far more often now that the
    // narrow header falls back to them.
    const target = mountCalendar({ locale: 'en-US' });
    const short = [...target.querySelectorAll('[role="radio"] span[aria-hidden="true"]')].map(
      (el) => el.textContent
    );
    expect(short).toEqual(['M', 'W', 'D', 'Y', 'A']);
    dispose?.();

    const german = mountCalendar({ locale: 'de-DE', initialLocale: 'de' });
    expect(
      [...german.querySelectorAll('[role="radio"] span[aria-hidden="true"]')].map(
        (el) => el.textContent
      )
    ).toEqual(['M', 'W', 'T', 'J', 'L']);
  });

  it('renders the short form alone at size="sm"', () => {
    // `sm` is already condensed by design — no need for the two-span swap.
    const target = mountCalendar({ locale: 'de-DE', initialLocale: 'de', size: 'sm' });
    const month = target.querySelectorAll('[role="radio"]')[0];
    expect(month.querySelectorAll('span')).toHaveLength(0);
    expect(month.textContent?.trim()).toBe('M');
    expect(month.getAttribute('aria-label')).toBe('Monat');
  });
});
