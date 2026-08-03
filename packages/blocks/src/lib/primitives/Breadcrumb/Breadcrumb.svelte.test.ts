// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import HomeIcon from '$lib/icons/HomeIcon.svelte';
import Breadcrumb from './Breadcrumb.svelte';
import type { BreadcrumbItem, BreadcrumbProps } from './index';

// Interaction layer for the collapsed-trail "…" expand affordance and the
// per-item onclick contract. The SSR smoke test (Breadcrumb.smoke.test.ts) pins
// the `entries` collapse derivation; this file drives the client-only paths —
// the expand click, the post-expand focus hand-off, and item click handlers.
// Item onclick mocks call preventDefault(): the documented client-router
// pattern, and it keeps jsdom from logging "Not implemented: navigation".

const EXPAND_LABEL = 'Show all breadcrumb items';

const trail = (): BreadcrumbItem[] => [
  { label: 'Alpha', href: '/a' },
  { label: 'Bravo', href: '/b' },
  { label: 'Charlie', href: '/c' },
  { label: 'Delta', href: '/d' },
  { label: 'Echo' }
];

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderBreadcrumb(props: Partial<BreadcrumbProps> = {}) {
  const instance = mount(Breadcrumb, {
    target: document.body,
    props: { items: trail(), ...props } as BreadcrumbProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Breadcrumb — ellipsis expand', () => {
  it('expands the collapsed middle on click and keeps the revealed items live', async () => {
    const onBravo = vi.fn((e: MouseEvent) => e.preventDefault());
    const items = trail();
    items[1] = { ...items[1], onclick: onBravo };
    renderBreadcrumb({ items, maxItems: 3 });

    // Collapsed: middle items are folded behind the localized "…" button.
    expect(screen.queryByRole('link', { name: 'Bravo' })).toBeNull();
    const expandBtn = screen.getByRole('button', { name: EXPAND_LABEL });
    await userEvent.click(expandBtn);

    for (const label of ['Alpha', 'Bravo', 'Charlie', 'Delta']) {
      expect(screen.getByRole('link', { name: label })).toBeTruthy();
    }
    // The expansion is permanent — the "…" affordance is gone.
    expect(screen.queryByRole('button', { name: EXPAND_LABEL })).toBeNull();

    // A revealed item's onclick is wired up, not just rendered.
    await userEvent.click(screen.getByRole('link', { name: 'Bravo' }));
    expect(onBravo).toHaveBeenCalledOnce();
  });

  it('moves focus to the first revealed link after expanding', async () => {
    renderBreadcrumb({ maxItems: 3 });

    await userEvent.click(screen.getByRole('button', { name: EXPAND_LABEL }));
    // expand() defers the focus hand-off one tick (the "…" button unmounts).
    await tick();
    await tick();

    // itemsBeforeCollapse=1 → head link is index 0, first revealed link is Bravo.
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Bravo' }));
  });

  it('honors a custom expandLabel as the button accessible name', async () => {
    renderBreadcrumb({ maxItems: 3, expandLabel: 'Mehr anzeigen' });

    await userEvent.click(screen.getByRole('button', { name: 'Mehr anzeigen' }));
    expect(screen.getByRole('link', { name: 'Charlie' })).toBeTruthy();
  });
});

describe('Breadcrumb — item semantics', () => {
  it('runs the item onclick handler with the mouse event', async () => {
    const onAlpha = vi.fn((e: MouseEvent) => e.preventDefault());
    const items = trail();
    items[0] = { ...items[0], onclick: onAlpha };
    renderBreadcrumb({ items });

    await userEvent.click(screen.getByRole('link', { name: 'Alpha' }));

    expect(onAlpha).toHaveBeenCalledOnce();
    expect(onAlpha.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('renders the last item as the current page, not a link', () => {
    renderBreadcrumb();

    const current = screen.getByText('Echo');
    expect(current.tagName).toBe('SPAN');
    expect(current.getAttribute('aria-current')).toBe('page');
    expect(screen.queryByRole('link', { name: 'Echo' })).toBeNull();
  });
});

// `BreadcrumbItem.icon` takes an icon *component* (the CommandPalette item
// convention), not path data and not a name — a name would need the runtime
// registry, which pulls every icon into the consumer bundle. A variants test
// can only see the class strings; these assert that the icon reaches an
// element, in the right crumb, without being announced next to the label it
// sits beside.
describe('Breadcrumb — item icons', () => {
  it('renders the icon inside the crumb link, ahead of the label and aria-hidden', () => {
    const items = trail();
    items[0] = { ...items[0], icon: HomeIcon };
    renderBreadcrumb({ items });

    const link = screen.getByRole('link', { name: 'Alpha' });
    const wrapper = link.firstElementChild;
    expect(wrapper?.tagName).toBe('SPAN');
    // Decorative: the glyph must not be read out on top of its own label.
    expect(wrapper?.getAttribute('aria-hidden')).toBe('true');
    // The glyph sizes itself; the wrapper is layout-only.
    expect(wrapper?.querySelector('svg')?.getAttribute('class')).toContain('size-4');
    expect(wrapper?.getAttribute('class')).not.toMatch(/(?:^|\s)size-/);
    // The label is still the only text in the crumb — the icon adds none.
    expect(link.textContent?.trim()).toBe('Alpha');
  });

  it('sizes the glyph absolutely, and scales it with the trail', () => {
    const items = trail();
    items[0] = { ...items[0], icon: HomeIcon };

    for (const [size, expected] of [
      ['sm', 'size-3.5'],
      ['md', 'size-4'],
      ['lg', 'size-5']
    ] as const) {
      renderBreadcrumb({ items, size });
      const glyph = screen.getByRole('link', { name: 'Alpha' }).querySelector('svg');
      expect(glyph?.getAttribute('class')).toContain(expected);
      dispose?.();
      document.body.replaceChildren();
    }
  });

  // The regression this file exists for. `unstyled` reduces every slot to
  // whatever the consumer passed, so a glyph sized off its wrapper (`size-full`)
  // had nothing to resolve against but the crumb link, and rendered at the
  // link's full width — 338px for a 16px icon in a plain-CSS repro. The glyph
  // keeps an absolute size in both modes.
  it('keeps the glyph absolutely sized in unstyled mode', () => {
    const items = trail();
    items[0] = { ...items[0], icon: HomeIcon };
    renderBreadcrumb({ items, unstyled: true });

    const wrapper = screen.getByRole('link', { name: 'Alpha' }).firstElementChild;
    // unstyled: the wrapper really is class-less (Svelte drops the attribute
    // for an empty value), so it offers no box…
    expect(wrapper?.getAttribute('class') ?? '').toBe('');
    // …which is exactly why the glyph must not depend on one.
    const glyphClass = wrapper?.querySelector('svg')?.getAttribute('class');
    expect(glyphClass).toContain('size-4');
    expect(glyphClass).not.toContain('size-full');
  });

  it('renders the icon on the current page as well', () => {
    const items = trail();
    items[items.length - 1] = { ...items[items.length - 1], icon: HomeIcon };
    renderBreadcrumb({ items });

    const current = screen.getByText('Echo');
    expect(current.getAttribute('aria-current')).toBe('page');
    const wrapper = current.querySelector('span[aria-hidden="true"]');
    expect(wrapper?.querySelector('svg')).not.toBeNull();
  });

  it('renders no icon markup for items that have none', () => {
    renderBreadcrumb();

    expect(document.querySelectorAll('nav svg').length).toBe(0);
    expect(document.querySelectorAll('nav span[aria-hidden="true"]').length).toBe(
      // only the four separators
      4
    );
  });

  it('leaves the collapsed ellipsis button free of item icons', () => {
    const items = trail().map((item) => ({ ...item, icon: HomeIcon }));
    renderBreadcrumb({ items, maxItems: 3 });

    const expandBtn = screen.getByRole('button', { name: EXPAND_LABEL });
    expect(expandBtn.querySelector('svg')).toBeNull();
    expect(expandBtn.textContent?.trim()).toBe('…');
    // the head/tail crumbs that survive the collapse still get theirs
    expect(screen.getByRole('link', { name: 'Alpha' }).querySelector('svg')).not.toBeNull();
  });

  // An icon-led last crumb is the case that made this matter: the icon is
  // aria-hidden, so a terse `label` leaves the current page with almost nothing
  // to announce. `aria-label` used to be read in the <a> branch only.
  it('applies a per-item aria-label to the current page, not only to links', () => {
    const items: BreadcrumbItem[] = [
      { label: 'Alpha', href: '/a' },
      { label: '', icon: HomeIcon, 'aria-label': 'Settings' }
    ];
    renderBreadcrumb({ items });

    const current = document.querySelector('[aria-current="page"]');
    expect(current?.getAttribute('aria-label')).toBe('Settings');
  });
});
