// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Dialog from './Dialog.svelte';
import type { DialogProps } from './index';

// Interaction layer for Dialog — the dismiss matrix (Escape / backdrop / close
// button, each gated by a `closeOn*` prop) and the `onClose` contract. Dialog is
// the native-`<dialog>` case: it opens via `showModal()` (scheduled a microtask
// out) and the panel plays an outro transition on close, so it needs a mounted
// DOM to drive at all.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom). The
// `children` snippet — which JSX-free component tests otherwise can't supply — is
// built with `createRawSnippet`. `showModal()` runs after a `tick()`, so tests
// `await tick()` once after mount before interacting.
//
// These tests assert dismiss *logic* (does `onClose` fire, is it suppressed when
// the matching `closeOn*` is false), not the exit animation or focus-trap visuals
// — that is Playwright's job. `onClose` fires synchronously inside `requestClose`,
// so it is the stable signal; the panel's async teardown is not asserted here.

const body = (text = 'Dialog body'): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderDialog(props: Partial<DialogProps> = {}) {
  const instance = mount(Dialog, {
    target: document.body,
    props: { children: body(), ...props } as DialogProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const dialog = () => screen.getByRole('dialog', { hidden: true });

describe('Dialog (component interaction)', () => {
  it('renders an open structured dialog with title, body, and aria-modal', async () => {
    renderDialog({
      open: true,
      title: 'Confirm deletion',
      children: body('This cannot be undone.')
    });
    await tick();

    const el = dialog();
    expect(el.getAttribute('aria-modal')).toBe('true');
    expect(el.getAttribute('data-state')).toBe('open');
    expect(screen.getByRole('heading', { name: 'Confirm deletion', hidden: true })).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    // Regression guard: the opener effect must defer showModal() until dialogEl is
    // bound (it captures the ref by value). `dialog.open` reflects that showModal()
    // actually ran — with the old same-tick call it stayed false (never modal).
    expect((el as HTMLDialogElement).open).toBe(true);
  });

  it('fires onClose on Escape (closeOnEscape defaults to true)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, onClose });
    await tick();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not fire onClose on Escape when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, closeOnEscape: false, onClose });
    await tick();

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().getAttribute('data-state')).toBe('open');
  });

  it('fires onClose when the close button is clicked', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    // A titled dialog without a footer renders exactly one button — the close control.
    renderDialog({ open: true, title: 'Settings', onClose });
    await tick();

    await user.click(screen.getByRole('button', { hidden: true }));

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('fires onClose on backdrop click (closeOnBackdropClick defaults to true)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, onClose });
    await tick();

    // Clicking the <dialog> element itself (outside the panel) is the backdrop
    // dismiss path — handleBackdropClick fires when target === currentTarget.
    await user.click(dialog());

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not fire onClose when the click originates inside the panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, onClose, children: body('Panel content') });
    await tick();

    // A click on content bubbles up to the <dialog>, but handleBackdropClick's
    // `target === currentTarget` guard must ignore it — only a click on the
    // backdrop itself dismisses. This is the discriminator the positive test
    // (which clicks the dialog element directly) cannot exercise.
    await user.click(screen.getByText('Panel content'));

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().getAttribute('data-state')).toBe('open');
  });

  it('does not fire onClose on backdrop click when closeOnBackdropClick is false', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, closeOnBackdropClick: false, onClose });
    await tick();

    await user.click(dialog());

    expect(onClose).not.toHaveBeenCalled();
    expect(dialog().getAttribute('data-state')).toBe('open');
  });
});
