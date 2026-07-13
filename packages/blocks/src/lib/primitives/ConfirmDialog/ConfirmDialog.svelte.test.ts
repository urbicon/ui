// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.svelte';
import type { ConfirmDialogProps } from './index';

// Interaction layer for ConfirmDialog — the async confirm/cancel choreography on
// top of Dialog. The dismiss matrix itself is Dialog's (covered in
// Dialog.svelte.test.ts); what's unique here is the confirm/cancel contract and
// the busy-lock: an async onConfirm keeps the dialog open + locked (spinner,
// no double-submit) until it resolves, then auto-closes. That needs a mounted
// DOM driven over time — a variant test can't reach it.
//
// Same stack as the Combobox pilot: svelte's own mount/unmount,
// @testing-library/dom + user-event, native vitest matchers. Dialog opens via
// showModal() a tick after mount, so tests `await tick()` once before driving.
// "Closed" is read from the dialog's data-state (open→'closed'), which flips
// synchronously — the panel's outro never finishes in jsdom (no WAAPI), so
// asserting DOM teardown would hang; the reactive attribute is the stable signal.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderConfirm(props: ConfirmDialogProps) {
  const instance = mount(ConfirmDialog, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const dialogState = () => screen.getByRole('dialog', { hidden: true }).getAttribute('data-state');
const confirmBtn = (name = 'Delete') =>
  screen.getByRole('button', { name, hidden: true }) as HTMLButtonElement;
const cancelBtn = (name = 'Keep') =>
  screen.getByRole('button', { name, hidden: true }) as HTMLButtonElement;

const base = {
  title: 'Delete project?',
  description: 'This cannot be undone.',
  confirmLabel: 'Delete',
  cancelLabel: 'Keep'
} satisfies Partial<ConfirmDialogProps>;

describe('ConfirmDialog (component interaction)', () => {
  it('renders a structured confirm dialog with title, description, and both buttons', async () => {
    renderConfirm({ ...base, open: true });
    await tick();

    expect(dialogState()).toBe('open');
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Delete project?', hidden: true })).toBeTruthy();
    expect(screen.getByText('This cannot be undone.')).toBeTruthy();
    expect(confirmBtn()).toBeTruthy();
    expect(cancelBtn()).toBeTruthy();
  });

  it('fires onConfirm and closes on confirm click', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    renderConfirm({ ...base, open: true, onConfirm });
    await tick();

    await user.click(confirmBtn());
    await tick();

    expect(onConfirm).toHaveBeenCalledOnce();
    expect(dialogState()).toBe('closed');
  });

  it('fires onCancel and closes on cancel click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    renderConfirm({ ...base, open: true, onConfirm, onCancel });
    await tick();

    await user.click(cancelBtn());
    await tick();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(dialogState()).toBe('closed');
  });

  it('cancels via Escape (routed through onClose → handleCancel)', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderConfirm({ ...base, open: true, onCancel });
    await tick();

    await user.keyboard('{Escape}');
    await tick();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(dialogState()).toBe('closed');
  });

  it('does not cancel on Escape when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderConfirm({ ...base, open: true, closeOnEscape: false, onCancel });
    await tick();

    await user.keyboard('{Escape}');

    expect(onCancel).not.toHaveBeenCalled();
    expect(dialogState()).toBe('open');
  });

  it('cancels on backdrop click', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    renderConfirm({ ...base, open: true, onCancel });
    await tick();

    // Clicking the <dialog> element itself (outside the panel) is the backdrop
    // dismiss path — ConfirmDialog forwards onClose=handleCancel.
    await user.click(screen.getByRole('dialog', { hidden: true }));
    await tick();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(dialogState()).toBe('closed');
  });

  it('awaits an async onConfirm, locking against double-submit, then auto-closes on resolve', async () => {
    // The headline contract: while the confirm promise is pending the dialog
    // stays open + busy — a second confirm click must not fire onConfirm again
    // (Button's loading guard), and cancel is disabled. Only on resolve does it
    // close. This is the exact behaviour the whole DOM layer exists to assert.
    const user = userEvent.setup();
    let resolveConfirm!: () => void;
    const onConfirm = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveConfirm = resolve;
        })
    );
    renderConfirm({ ...base, open: true, onConfirm });
    await tick();

    const confirm = confirmBtn();
    const cancel = cancelBtn();

    await user.click(confirm);
    // Pending: onConfirm fired once, the button reports busy, cancel is locked.
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(cancel.disabled).toBe(true);
    expect(dialogState()).toBe('open');

    // Double-submit guard: a second click while busy is a no-op.
    await user.click(confirm);
    expect(onConfirm).toHaveBeenCalledOnce();

    // Resolve → the try/finally sets open=false and clears busy.
    resolveConfirm();
    await tick();
    await tick();

    expect(dialogState()).toBe('closed');
  });

  it('locks both buttons and blocks dismissal while the external loading flag is set', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    renderConfirm({ ...base, open: true, loading: true, onConfirm, onCancel });
    await tick();

    const confirm = confirmBtn();
    expect(confirm.getAttribute('aria-busy')).toBe('true');
    expect(cancelBtn().disabled).toBe(true);

    // Confirm is guarded by its loading state; Escape is disabled (closeOnEscape
    // && !isLoading resolves to false), so neither handler runs.
    await user.click(confirm);
    await user.keyboard('{Escape}');

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
    expect(dialogState()).toBe('open');
  });

  it('forwards the styling contract (class, slotClasses, unstyled) to the underlying Dialog', async () => {
    // ConfirmDialog owns no tv() config — unstyled/slotClasses/preset resolve
    // against the inner Dialog. This guards the pass-through (P1 styling-
    // contract fix: ConfirmDialog previously declared none of the trio).
    renderConfirm({
      ...base,
      open: true,
      class: 'confirm-root-marker',
      slotClasses: { title: 'confirm-title-marker' }
    });
    await tick();

    // Dialog applies `class` to the visible root slot (the panel), not the
    // full-viewport <dialog> wrapper — same as every multi-slot component.
    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.querySelector('.confirm-root-marker')).toBeTruthy();
    const heading = screen.getByRole('heading', { name: 'Delete project?', hidden: true });
    expect(heading.className).toContain('confirm-title-marker');
    // Styled mode: default tv() classes are still present alongside the override.
    expect(heading.className).toContain('font-semibold');
  });

  it('unstyled strips the Dialog defaults and keeps only slotClasses', async () => {
    renderConfirm({
      ...base,
      open: true,
      unstyled: true,
      slotClasses: { title: 'bare-title' }
    });
    await tick();

    const heading = screen.getByRole('heading', { name: 'Delete project?', hidden: true });
    expect(heading.className).toContain('bare-title');
    expect(heading.className).not.toContain('font-semibold');
  });

  it('forwards arbitrary HTML attributes (data-*, aria-label) to the underlying dialog element', async () => {
    // ConfirmDialogProps now extends HTMLDialogAttributes (mirroring Dialog/Drawer),
    // so consumer-supplied attributes flow through rest props onto the inner Dialog
    // and land on the same <dialog> element Dialog itself spreads onto — the hook the
    // e2e overlay-modal spec needs. Before this the interface was closed, forcing the
    // spec to target ConfirmDialog by text/structure. The props object below also
    // type-checks the pass-through: `data-testid` and `aria-label` are only valid
    // ConfirmDialog props because of the HTMLDialogAttributes extension.
    renderConfirm({
      ...base,
      open: true,
      'data-testid': 'confirm-delete',
      'aria-label': 'Confirm deletion'
    });
    await tick();

    const dialog = screen.getByRole('dialog', { hidden: true });
    expect(dialog.getAttribute('data-testid')).toBe('confirm-delete');
    expect(dialog.getAttribute('aria-label')).toBe('Confirm deletion');
  });
});
