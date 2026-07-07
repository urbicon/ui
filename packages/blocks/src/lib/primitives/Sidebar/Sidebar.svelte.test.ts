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
