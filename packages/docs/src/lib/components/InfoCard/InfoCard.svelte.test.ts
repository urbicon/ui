// @vitest-environment jsdom
import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import InfoCard from './InfoCard.svelte';
import type { InfoCardProps } from './index.js';

let cleanup: (() => void) | null = null;

function render(props: InfoCardProps) {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(InfoCard, { target, props });
  cleanup = () => {
    unmount(component);
    target.remove();
  };
  return target;
}

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

describe('InfoCard', () => {
  it('renders an aside named by its title', () => {
    const target = render({ title: 'Heads up' });
    const aside = target.querySelector('aside');

    expect(aside).not.toBeNull();
    expect(aside?.getAttribute('aria-label')).toBe('Heads up');
  });

  it('renders the title as an h3 by default, clamped to 1..6 when set', () => {
    // A card sits under a Section (h2), so h3. It was a fixed h4 until 2026-08,
    // which put an h2 → h4 skip on every page using a card under a section.
    expect(render({ title: 'Heads up' }).querySelector('h3')?.textContent?.trim()).toBe('Heads up');
    cleanup?.();

    expect(render({ title: 'Top', headingLevel: 2 }).querySelector('h2')).not.toBeNull();
    cleanup?.();

    expect(
      render({ title: 'Clamped', headingLevel: 99 as InfoCardProps['headingLevel'] }).querySelector(
        'h6'
      )
    ).not.toBeNull();
  });

  it('falls back to a generic label when there is no title', () => {
    // Several InfoCards share a page and every one is a complementary
    // landmark, so an unnamed one is indistinguishable from its neighbours.
    const target = render({});

    expect(target.querySelector('aside')?.getAttribute('aria-label')).toBe('Note');
  });

  it('renders an anchor instead of an aside when href is set', () => {
    const target = render({ title: 'Read on', href: '/somewhere' });

    expect(target.querySelector('aside')).toBeNull();
    expect(target.querySelector('a')?.getAttribute('href')).toBe('/somewhere');
  });

  it('hides the icon from assistive tech without claiming an image role', () => {
    // Regression: the icon carried `role="img"` AND `aria-hidden="true"` — a
    // hidden element with an image role names nothing and contradicts itself.
    const target = render({ title: 'Tip', icon: '💡' });
    const icon = target.querySelector('[aria-hidden="true"]');

    expect(icon).not.toBeNull();
    expect(icon?.getAttribute('role')).toBeNull();
  });

  it('applies class and slotClasses, and drops tv defaults under unstyled', () => {
    const target = render({
      title: 'Tip',
      class: 'outer',
      unstyled: true,
      slotClasses: { container: 'inner' }
    });

    expect(target.querySelector('aside')?.className).toBe('inner outer');
  });

  it('forwards arbitrary attributes to the root', () => {
    const target = render({ title: 'Tip', 'data-testid': 'card' } as InfoCardProps);

    expect(target.querySelector('aside')?.getAttribute('data-testid')).toBe('card');
  });
});
