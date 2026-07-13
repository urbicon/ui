// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
