// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Drawer from './Drawer.svelte';
import type { DrawerProps } from './index';

// Interaction layer for Drawer — only the modal-promotion lifecycle it does NOT
// share with Dialog through overlay.ts: the opener effect (tick-deferred
// showDialogModal + teardown guard) is duplicated per component, so a
// copy-paste regression in Drawer.svelte would slip past Dialog.svelte.test.ts.
// The dismiss matrix (Escape/backdrop/close button) is structurally identical
// to Dialog's and is asserted there; visual behaviour (slide-in, top layer) is
// Playwright's job.

const body = (text = 'Drawer body'): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderDrawer(props: Partial<DrawerProps> = {}) {
  const instance = mount(Drawer, {
    target: document.body,
    props: { children: body(), ...props } as DrawerProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const drawer = () => screen.getByRole('dialog', { hidden: true });

describe('Drawer (component interaction)', () => {
  it('enters the modal state once the deferred showModal has run', async () => {
    renderDrawer({ open: true, title: 'Filters' });
    await tick();

    // Regression guard (mirrors Dialog): the opener effect must defer
    // showModal() until bind:this has assigned the ref — with the old
    // same-tick call `open` stayed false (never modal).
    expect((drawer() as HTMLDialogElement).open).toBe(true);
  });

  it('does not leak a body scroll lock when unmounted before the deferred showModal', async () => {
    renderDrawer({ open: true });
    // Tear down before the opener effect's tick().then callback has run: the
    // unmount nulls dialogElement and onDestroy has already unlocked, so an
    // unguarded callback would lockBodyScroll() with nothing ever unlocking —
    // the whole page stays overflow:hidden (module-global refcount).
    dispose?.();
    dispose = undefined;
    await tick();

    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
