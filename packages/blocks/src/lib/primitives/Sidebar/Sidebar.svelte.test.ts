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
  /**
   * Both halves of the pair, read off the panel.
   *
   * Deliberately NOT reporting "does the panel contain something focusable":
   * the first version asked `panel?.querySelector(…) !== null`, which is `true`
   * even when there is no panel at all (`undefined !== null`) and stays `true`
   * for `tabindex="-1"` children — it could not go false in any reachable state.
   * Whether focus can actually enter is measured in the browser, by the axe
   * `aria-hidden-focus` scan; jsdom implements no part of `inert`.
   */
  function panelState() {
    const panel = document.querySelector('aside');
    return {
      ariaHidden: panel?.getAttribute('aria-hidden') ?? null,
      inert: panel?.hasAttribute('inert') ?? false
    };
  }

  const nav = (): Snippet =>
    createRawSnippet(() => ({ render: () => '<nav><a href="/x">Link</a></nav>' }));

  it('collapsible + desktop + closed: hidden from AT and out of the tab order', () => {
    stubViewport(false);
    renderSidebar({ open: false, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true });
  });

  it('collapsible + desktop + open: neither', () => {
    stubViewport(false);
    renderSidebar({ open: true, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false });
  });

  it('responsive + mobile + closed: hidden from AT and out of the tab order', () => {
    stubViewport(true);
    renderSidebar({ open: false, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true });
  });

  it('responsive + mobile + open: neither', () => {
    stubViewport(true);
    renderSidebar({ open: true, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false });
  });

  it('responsive + desktop: persistent layout, never hidden either way', () => {
    // On desktop a responsive panel is pinned at translateX(0) at full width
    // regardless of `open` — marking it hidden would take a visible region out
    // of the tab order.
    stubViewport(false);
    renderSidebar({ open: false, mode: 'responsive', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: null, inert: false });
  });

  it('collapsible + mobile + closed: hidden from AT and out of the tab order', () => {
    stubViewport(true);
    renderSidebar({ open: false, mode: 'collapsible', children: nav() });

    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true });
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
    expect(panelState()).toEqual({ ariaHidden: null, inert: false });

    props.open = false;
    await tick();
    expect(panelState()).toEqual({ ariaHidden: 'true', inert: true });
  });

  it('really is the same element throughout — the attributes track, not a remount', () => {
    stubViewport(false);
    const props = $state({ open: false, mode: 'collapsible' as const, children: nav() });
    const instance = mount(Sidebar, { target: document.body, props: props as SidebarProps });
    dispose = () => unmount(instance);
    flushSync();

    // Without this the previous test passes for a component that tears the
    // <aside> down and rebuilds it per toggle, which would lose focus, scroll
    // position and any transition.
    const first = document.querySelector('aside');
    props.open = true;
    flushSync();
    expect(document.querySelector('aside')).toBe(first);
  });
});

// #138 follow-up: making a subtree inert while focus is inside it makes the
// browser drop focus to <body>. The mobile path always restored it; the
// desktop-collapsible path — the one the fix is about — never captured anything
// to restore, so the fix would have cost the keyboard user their place.
describe('Sidebar (focus handover when the panel hides)', () => {
  const nav = (): Snippet =>
    createRawSnippet(() => ({ render: () => '<nav><button type="button">Nav</button></nav>' }));

  it('returns focus to the control that opened the panel', async () => {
    stubViewport(false);
    const opener = document.createElement('button');
    opener.textContent = 'Toggle';
    document.body.append(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const props = $state({ open: false, mode: 'collapsible' as const, children: nav() });
    const instance = mount(Sidebar, { target: document.body, props: props as SidebarProps });
    dispose = () => unmount(instance);
    flushSync();

    // Open, then move focus into the panel the way a keyboard user would.
    props.open = true;
    await tick();
    const inPanel = document.querySelector('aside button') as HTMLElement;
    inPanel.focus();
    expect(document.activeElement).toBe(inPanel);

    // Closing from inside the panel is exactly what the docs demo does.
    props.open = false;
    await tick();

    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('leaves focus alone when it was never inside the panel', async () => {
    stubViewport(false);
    const outside = document.createElement('button');
    document.body.append(outside);

    const props = $state({ open: true, mode: 'collapsible' as const, children: nav() });
    const instance = mount(Sidebar, { target: document.body, props: props as SidebarProps });
    dispose = () => unmount(instance);
    flushSync();

    outside.focus();
    props.open = false;
    await tick();

    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
