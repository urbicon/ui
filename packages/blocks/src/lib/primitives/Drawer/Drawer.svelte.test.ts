// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockBodyScroll } from '../../utils/overlay';
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

  it('unmounting a closed drawer leaves a foreign scroll lock intact', async () => {
    // Mirrors the Dialog test — the onDestroy release path is duplicated per
    // component, so each needs its own guard against freeing another
    // overlay's share of the module-global lock.
    const releaseForeign = lockBodyScroll();
    try {
      renderDrawer({ open: false });
      dispose?.();
      dispose = undefined;
      await tick();

      expect(document.body.style.overflow).toBe('hidden');
    } finally {
      releaseForeign();
    }
  });

  it('stays open when an inner widget already consumed the Escape', async () => {
    // Asserted here as well as in Dialog for the reason this file exists: the
    // keydown handler is a duplicate, not a shared helper, and it carried the
    // same defect in both copies. A drawer holding any control with a panel
    // hits it — the table's tools sheet holds the filter form's operator
    // Select, where dismissing the dropdown used to close the whole sheet.
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({
      open: true,
      onClose,
      children: createRawSnippet(() => ({
        render: () => `<button type="button" data-testid="inner">Operator</button>`
      }))
    });
    await tick();

    const inner = screen.getByTestId('inner');
    inner.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.preventDefault();
    });
    inner.focus();

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(drawer().getAttribute('data-state')).toBe('open');
  });
});

// restProps contract on the <dialog> (see docs/COMPONENT-API-CONVENTIONS.md).
// Same reason this file guards the opener effect: the destructure-and-compose
// wiring is duplicated in Drawer.svelte rather than shared, so a copy-paste
// regression would slip past Dialog.svelte.test.ts. Drawer composes two
// handlers, not three — its <dialog> has no internal onclick (the backdrop is
// a child div), so a consumer onclick rides the plain spread.
describe('Drawer (restProps composition)', () => {
  it('runs a consumer onkeydown and still closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onkeydown = vi.fn();
    renderDrawer({ open: true, onClose, onkeydown });
    await tick();

    await user.keyboard('{Escape}');

    expect(onkeydown).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('runs a consumer onclose and still routes the native close through onClose', async () => {
    const onClose = vi.fn();
    const onclose = vi.fn();
    renderDrawer({ open: true, onClose, onclose });
    await tick();

    drawer().dispatchEvent(new Event('close'));

    expect(onclose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the focus trap intact with a consumer onkeydown present', async () => {
    const onkeydown = vi.fn();
    renderDrawer({ open: true, title: 'Trapped', onkeydown });
    await tick();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const notPrevented = drawer().dispatchEvent(event);

    expect(notPrevented).toBe(false);
    expect(onkeydown).toHaveBeenCalledOnce();
  });

  it('does not let a consumer preventDefault veto the Escape dismiss', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDrawer({ open: true, onClose, onkeydown: (event) => event.preventDefault() });
    await tick();

    await user.keyboard('{Escape}');

    // Deliberate: preventDefault is not a veto — `closeOnEscape={false}` is.
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('delivers a consumer onclick through the spread', async () => {
    const user = userEvent.setup();
    const onclick = vi.fn();
    renderDrawer({ open: true, onclick });
    await tick();

    await user.click(drawer());

    expect(onclick).toHaveBeenCalledOnce();
  });

  it('lets internal aria-modal and data-state win over restProps', async () => {
    renderDrawer({ open: true, 'aria-modal': 'false', 'data-state': 'closed' });
    await tick();

    expect(drawer().getAttribute('aria-modal')).toBe('true');
    expect(drawer().getAttribute('data-state')).toBe('open');
  });

  it('falls back to a consumer aria-labelledby when no title is rendered', async () => {
    renderDrawer({ open: true, 'aria-labelledby': 'external-heading' });
    await tick();

    expect(drawer().getAttribute('aria-labelledby')).toBe('external-heading');
  });

  it('merges a consumer aria-describedby after the internal body id', async () => {
    renderDrawer({ open: true, 'aria-describedby': 'external-hint' });
    await tick();

    const ids = (drawer().getAttribute('aria-describedby') as string).split(' ');
    expect(ids).toHaveLength(2);
    expect(document.getElementById(ids[0])?.textContent).toContain('Drawer body');
    expect(ids[1]).toBe('external-hint');
  });
});

// Initial-focus fallback (mirrors the Dialog suite). The focus logic itself is
// shared via overlay.ts, but the panel's tabindex="-1" — the attribute the
// fallback focuses — is duplicated in Drawer.svelte's markup, so a copy-paste
// regression there would slip past Dialog.svelte.test.ts. Drawer reaches the
// no-focusable state through `hideCloseButton` (untitled + hidden close button
// renders no header at all).
describe('Drawer (initial focus + no-focusable fallback)', () => {
  it('falls back to focusing the panel when nothing inside is focusable', async () => {
    renderDrawer({ open: true, hideCloseButton: true });
    // focusFirstElement defers one tick beyond the deferred showDialogModal.
    await tick();
    await tick();

    const panel = screen.getByRole('document', { hidden: true });
    expect(document.activeElement).toBe(panel);
    expect((panel as HTMLElement).tabIndex).toBe(-1);
  });
});
