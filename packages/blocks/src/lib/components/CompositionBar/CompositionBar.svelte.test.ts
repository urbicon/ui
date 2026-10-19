// @vitest-environment jsdom
import type { Locale } from '@urbicon-ui/i18n';
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ChartLocaleHost from '#lib/internal/charts/__fixtures__/ChartLocaleHost.svelte';
import CompositionBar from './CompositionBar.svelte';

// Accessibility contract of the bar root: a named group, not role="img" — img
// flattens the subtree in the accessibility tree and would hide the interactive
// segment <button>s from screen readers. Plus the default percent format, which
// the segment names carry. Repo stack: svelte's own mount/unmount, native
// matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function renderBar(props: ComponentProps<typeof CompositionBar>, locale?: Locale) {
  const instance =
    locale !== undefined
      ? mount(ChartLocaleHost, {
          target: document.body,
          props: { locale, chart: CompositionBar, props: { ...props } }
        })
      : mount(CompositionBar, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const shares = [
  { label: 'Gas', value: 60 },
  { label: 'Power', value: 40 }
];

function segmentLabels() {
  return Array.from(document.querySelectorAll('button[data-composition-segment]'), (b) =>
    b.getAttribute('aria-label')
  );
}

describe('CompositionBar (accessibility contract)', () => {
  it('exposes the bar as a named group with its interactive segments', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60 },
        { label: 'Power', value: 40 }
      ]
    });

    const bar = document.querySelector('[role="group"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-label')).toBeTruthy();
    // The segments stay perceivable as individual buttons inside the group.
    expect(bar?.querySelectorAll('button[data-composition-segment]').length).toBe(2);
  });
});

describe('CompositionBar (default percent format)', () => {
  it('writes the percent sign the way the active locale does', () => {
    renderBar({ items: shares });
    expect(segmentLabels()).toEqual(['Gas: 60 (60.0%)', 'Power: 40 (40.0%)']);
    expect(document.querySelector('[role="group"]')?.getAttribute('aria-label')).toBe(
      'Composition: 100 (2 shares) — Gas 60.0%, Power 40.0%'
    );
  });

  it('follows a non-base locale', () => {
    renderBar({ items: shares }, 'de');
    expect(segmentLabels()).toEqual(['Gas: 60 (60,0\u00a0%)', 'Power: 40 (40,0\u00a0%)']);
  });

  // A provider does not validate its locale; `Intl` throws on these two.
  it.each(['de_DE', ''])('renders in English under the provider locale %j', (locale) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderBar({ items: shares }, locale as Locale);
    expect(segmentLabels()).toEqual(['Gas: 60 (60.0%)', 'Power: 40 (40.0%)']);
  });
});
