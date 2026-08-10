// @vitest-environment jsdom
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { lockBodyScroll } from '../../utils/overlay';
import type { SidebarProps } from './index';
import Sidebar from './Sidebar.svelte';

// Interaction layer for Sidebar — only the body-scroll-lock lifecycle. Sidebar
// gates the lock on `open && isMobile` (a `MediaQuery`), so the viewport is
// driven by replacing `window.matchMedia` before mount (the vitest-setup stub
// always reports "no match" = desktop). Everything else (variant classes,
// responsive CSS) is covered by sidebar.variants.test.ts and Playwright.

const body = (): Snippet => createRawSnippet(() => ({ render: () => '<p>Nav</p>' }));

let dispose: (() => void) | undefined;
const originalMatchMedia = window.matchMedia;

/** Force every media query to (not) match — Sidebar only probes the mobile breakpoint. */
function stubViewport(mobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: mobile,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  document.body.style.overflow = '';
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  window.matchMedia = originalMatchMedia;
  document.body.replaceChildren();
});

function renderSidebar(props: Partial<SidebarProps> = {}) {
  const instance = mount(Sidebar, {
    target: document.body,
    props: { children: body(), ...props } as SidebarProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Sidebar (scroll-lock lifecycle)', () => {
  it('locks body scroll while open on mobile and releases it on close', async () => {
    stubViewport(true);
    const user = userEvent.setup();
    renderSidebar({ open: true });
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('takes no scroll lock on desktop', () => {
    stubViewport(false);
    renderSidebar({ open: true });

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('releases its lock when unmounted while open on mobile', () => {
    stubViewport(true);
    renderSidebar({ open: true });
    expect(document.body.style.overflow).toBe('hidden');

    dispose?.();
    dispose = undefined;
    flushSync();

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('unmounting a closed sidebar leaves a foreign scroll lock intact', async () => {
    // The old code unlocked twice on destroy (unconditional effect cleanup +
    // onDestroy), decrementing a lock this instance never held — freeing
    // another overlay's share of the module-global refcount.
    stubViewport(false);
    const releaseForeign = lockBodyScroll();
    try {
      renderSidebar({ open: false });
      dispose?.();
      dispose = undefined;
      await tick();

      expect(document.body.style.overflow).toBe('hidden');
    } finally {
      releaseForeign();
    }
  });
});

// #138: the panel keeps its children mounted when it is out of sight, so
// `aria-hidden` alone left them in the tab order — a keyboard user walked into
// a region the screen reader had been told to skip. The two attributes are now
// derived from one expression; these assert both halves in every mode, because
// a regression that reintroduces the drift will only show on ONE of them.
//
// SCOPE: these assert the ATTRIBUTES, not their effect. jsdom implements no part
// of `inert` — measured: it does not expose the `.inert` property and `focus()`
// still lands inside an inert subtree — so nothing here could prove the tab
// order. The effect is covered where a real engine applies it: the axe
// `aria-hidden-focus` scan in `e2e/a11y.spec.ts`, whose baseline exception for
// this defect is removed in the same commit.
describe('Sidebar (hidden panel is inert, per mode)', () => {
  /** Both halves of the pair, read off the panel. */
  function panelState() {
    const panel = document.querySelector('aside');
    return {
      ariaHidden: panel?.getAttribute('aria-hidden'),
      inert: panel?.hasAttribute('inert'),
      focusable: panel?.querySelector('a,button,input,[tabindex]') !== null
    };
  }

  const nav = (): Snippet =>
    createRawSnippet(() => ({ render: () => '<nav><a href="/x">Link</a></nav>' }));

  it('collapsible + desktop + closed: hidden from AT and out of the tab order', () => {
    stubViewport(false);
    renderSidebar({ open: false, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true, focusable: true });
  });

  it('collapsible + desktop + open: neither', () => {
    stubViewport(false);
    renderSidebar({ open: true, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false, focusable: true });
  });

  it('responsive + mobile + closed: hidden from AT and out of the tab order', () => {
    stubViewport(true);
    renderSidebar({ open: false, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true, focusable: true });
  });

  it('responsive + mobile + open: neither', () => {
    stubViewport(true);
    renderSidebar({ open: true, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false, focusable: true });
  });

  it('responsive + desktop: persistent layout, never hidden either way', () => {
    // On desktop a responsive panel is pinned at translateX(0) at full width
    // regardless of `open` — marking it hidden would take a visible region out
    // of the tab order.
    stubViewport(false);
    renderSidebar({ open: false, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false, focusable: true });
  });

  it('collapsible + mobile + closed: hidden from AT and out of the tab order', () => {
    stubViewport(true);
    renderSidebar({ open: false, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true, focusable: true });
  });

  it('follows `open` without a remount, in both directions', async () => {
    stubViewport(false);
    // A reactive props object, so `open` can be driven the way a consumer does
    // — remounting per state would not prove the attributes track the prop.
    const props = $state({ open: false, mode: 'collapsible' as const, children: nav() });
    const instance = mount(Sidebar, { target: document.body, props: props as SidebarProps });
    dispose = () => unmount(instance);
    flushSync();
    expect(panelState().inert).toBe(true);

    props.open = true;
    await tick();
    expect(panelState()).toEqual({ ariaHidden: null, inert: false, focusable: true });

    props.open = false;
    await tick();
    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true, focusable: true });
  });
});
