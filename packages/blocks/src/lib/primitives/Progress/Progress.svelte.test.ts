// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import type { Locale } from '@urbicon-ui/i18n';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProgressLocaleHarness from './__fixtures__/ProgressLocaleHarness.svelte';
import type { ProgressProps } from './index';
import Progress from './Progress.svelte';

// DOM tests for Progress. The circular shape's spin is applied inline in the
// markup (`animate-spin` on the <svg>), not through the tv() config, so the
// variants suite cannot see it — these tests guard the class list on the
// rendered element instead. Mounting uses Svelte's own `mount`/`unmount`
// (not @testing-library/svelte).

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function render(props: ProgressProps, locale?: Locale) {
  const instance =
    locale !== undefined
      ? mount(ProgressLocaleHarness, { target: document.body, props: { ...props, locale } })
      : mount(Progress, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Progress (circular)', () => {
  // #203: the spin must halt under prefers-reduced-motion. With the animation
  // off, the static quarter arc (75% dash offset) keeps the indeterminate
  // state recognizable — same contract as CoreSpinner.
  it('spins while indeterminate, with a motion-reduce guard', () => {
    render({ shape: 'circular' });

    const svg = screen.getByRole('progressbar').querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg?.classList.contains('animate-spin')).toBe(true);
    expect(svg?.classList.contains('motion-reduce:animate-none')).toBe(true);
  });

  it('does not spin when a value is set', () => {
    render({ shape: 'circular', value: 40 });

    const svg = screen.getByRole('progressbar').querySelector('svg');
    expect(svg?.classList.contains('animate-spin')).toBe(false);
  });
});

describe('Progress (circular geometry)', () => {
  const ring = () => screen.getByRole('progressbar').querySelector('svg') as SVGSVGElement;
  const stroke = () => ring().querySelector('circle')?.getAttribute('stroke-width');

  it('follows size while circularSize and strokeWidth are unset', () => {
    render({ shape: 'circular', value: 40, size: 'lg' });
    expect(ring().getAttribute('width')).toBe('112');
    expect(stroke()).toBe('8');
  });

  it('honours an explicit circularSize and strokeWidth, the md values included', () => {
    render({ shape: 'circular', value: 40, size: 'lg', circularSize: 80, strokeWidth: 6 });
    expect(ring().getAttribute('width')).toBe('80');
    expect(stroke()).toBe('6');
  });
});

describe('Progress (value text)', () => {
  it('reads an empty range as 0%, as its fill does', () => {
    render({ value: 5, min: 5, max: 5, showValue: true });
    expect(screen.getByRole('progressbar').textContent?.trim()).toBe('0%');
  });

  it('writes the percent sign the way the active locale does', () => {
    render({ value: 65, showValue: true }, 'de');
    expect(screen.getByRole('progressbar').textContent?.trim()).toBe('65\u00a0%');
  });

  // A provider does not validate its locale; `Intl` throws on these two.
  it.each(['de_DE', ''])('renders in English under the provider locale %j', (locale) => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    render({ value: 65, showValue: true }, locale as Locale);
    expect(screen.getByRole('progressbar').textContent?.trim()).toBe('65%');
  });
});
