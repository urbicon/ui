// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import SurfaceHarness from '../../internal/__fixtures__/SurfaceHarness.svelte';
import Dialog from './Dialog.svelte';
import type { DialogProps } from './index';

// Interaction layer for what only Dialog has: the backdrop click on the
// <dialog> element itself, the drag handle, the composed `onclick`, the
// labelling, the intent markers and the dead-end guard. The modal lifecycle and
// dismiss policy it shares with Drawer — Escape on both paths, native
// cancel/close, the backdrop layer, focus in and out, the scroll lock — is
// asserted once for both in `internal/modal-surface.svelte.test.ts`.
//
// Same stack + rationale as the Combobox pilot: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers (no jest-dom). The
// `children` snippet — which JSX-free component tests otherwise can't supply — is
// built with `createRawSnippet`. `showModal()` runs after a `tick()`, so tests
// `await tick()` once after mount before interacting.

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

describe('Dialog (<dialog>-level backdrop click)', () => {
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

// Draggable mode. The header is the drag handle; dragging translates the
// panel from its centred position. Pointer sequences use fireEvent (not
// user-event) for deterministic clientX/clientY control. jsdom has no layout, so
// these assert the offset bookkeeping, not visual position.
describe('Dialog (draggable)', () => {
  const panel = () => screen.getByRole('document', { hidden: true });
  const header = () => panel().querySelector('header') as HTMLElement;

  // jsdom's PointerEvent ignores clientX/clientY from init, so fireEvent.pointer*
  // dispatches coordinate-less events. A MouseEvent carries the coords reliably;
  // dispatched under a pointer* type it still triggers the pointer listeners, and
  // the missing pointerId is harmless (setPointerCapture is a no-op stub).
  const pointer = (el: Element, type: string, clientX: number, clientY: number) => {
    el.dispatchEvent(new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true }));
    // The drag handler mutates $state; flush so the panel's style:translate lands
    // before the assertion reads it back.
    flushSync();
  };

  it('makes the header a move handle only when draggable', async () => {
    renderDialog({ open: true, title: 'Movable', draggable: true });
    await tick();
    expect(header().style.cursor).toBe('move');
    expect(header().style.touchAction).toBe('none');
  });

  it('leaves the header untouched when not draggable', async () => {
    renderDialog({ open: true, title: 'Static' });
    await tick();
    expect(header().style.cursor).toBe('');
  });

  it('translates the panel as the header is dragged', async () => {
    renderDialog({ open: true, title: 'Movable', draggable: true });
    await tick();

    expect(panel().style.translate).toBe('');
    pointer(header(), 'pointerdown', 100, 100);
    pointer(header(), 'pointermove', 160, 130);
    expect(panel().style.translate).toBe('60px 30px');

    // A second grab continues from the current offset, it does not reset.
    pointer(header(), 'pointerup', 160, 130);
    pointer(header(), 'pointerdown', 0, 0);
    pointer(header(), 'pointermove', 10, -5);
    expect(panel().style.translate).toBe('70px 25px');
  });

  it('does not start a drag from a header button (close stays clickable)', async () => {
    renderDialog({ open: true, title: 'Movable', draggable: true });
    await tick();

    const closeBtn = header().querySelector('button') as HTMLElement;
    pointer(closeBtn, 'pointerdown', 100, 100);
    pointer(header(), 'pointermove', 200, 200);
    // No drag was armed, so the panel never moved.
    expect(panel().style.translate).toBe('');
  });

  it('resets the offset when reopened', async () => {
    renderDialog({ open: true, title: 'Movable', draggable: true });
    await tick();
    pointer(header(), 'pointerdown', 0, 0);
    pointer(header(), 'pointermove', 40, 40);
    expect(panel().style.translate).toBe('40px 40px');
    // Toggling open resets the drag offset — but jsdom keeps the panel mounted
    // through the outro, so assert the reset via a fresh mount instead.
    dispose?.();
    renderDialog({ open: true, title: 'Movable', draggable: true });
    await tick();
    expect(panel().style.translate).toBe('');
  });

  // Through a consumer's real `bind:open`, which the veto's write-back needs.
  function renderBound(props: { vetoClose?: boolean; transitionDuration?: number } = {}) {
    const instance = mount(SurfaceHarness, {
      target: document.body,
      props: { surface: 'Dialog', title: 'Movable', draggable: true, ...props }
    });
    dispose = () => unmount(instance);
    flushSync();
    return instance as unknown as { setOpen: (open: boolean) => void };
  }

  const dragBy = (x: number, y: number) => {
    pointer(header(), 'pointerdown', 0, 0);
    pointer(header(), 'pointermove', x, y);
    pointer(header(), 'pointerup', x, y);
  };

  it('stays where it was dragged through a close vetoed in onClose', async () => {
    renderBound({ vetoClose: true });
    await tick();
    dragBy(40, 40);

    await userEvent.setup().keyboard('{Escape}');
    flushSync();

    expect(dialog().getAttribute('data-state')).toBe('open');
    expect(panel().style.translate).toBe('40px 40px');
  });

  it('recentres when reopened after a close', async () => {
    const harness = renderBound({ transitionDuration: 0 });
    await tick();
    dragBy(40, 40);

    harness.setOpen(false);
    flushSync();
    await tick();
    harness.setOpen(true);
    flushSync();
    await tick();

    expect(panel().style.translate).toBe('');
  });
});

// restProps contract on the <dialog> (see docs/COMPONENT-API-CONVENTIONS.md).
// Dialog spreads {...restProps} FIRST so its own attributes win, which alone
// would clobber a consumer's DOM handlers — the exact bug pointed the other
// way. So the three behavioural handlers are destructured out and composed:
// internal first (unconditional), consumer second. These tests pin both halves
// — the consumer's handler runs AND the internal dismiss/focus/close path
// survives — because a regression in either direction is silent. The keydown,
// close and cancel compositions are shared with Drawer and pinned in
// `internal/modal-surface.svelte.test.ts`; the `onclick` one is Dialog's alone.
describe('Dialog (restProps composition)', () => {
  it('runs a consumer onclick and still dismisses on backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onclick = vi.fn();
    renderDialog({ open: true, onClose, onclick });
    await tick();

    await user.click(dialog());

    expect(onclick).toHaveBeenCalledOnce();
    // The pre-fix ordering (restProps last) made the consumer handler replace
    // handleBackdropClick outright, so this assertion is the regression guard.
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not let a consumer preventDefault veto the backdrop dismiss', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({ open: true, onClose, onclick: (event) => event.preventDefault() });
    await tick();

    await user.click(dialog());

    // Deliberate: the consumer handler runs after the internal one, so
    // preventDefault is not a veto. Opting out of dismissal is spelled with
    // the named prop (`closeOnBackdropClick={false}`), never with a magic
    // event side-effect — see composeHandlers' module doc.
    //
    // The click path is the honest test of that rule: handleBackdropClick
    // never calls preventDefault itself, so a surviving dismiss can only mean
    // the consumer's veto was ignored. (On Escape the internal handler
    // preventDefaults anyway, which would mask the result.)
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('lets internal aria-modal and data-state win over restProps', async () => {
    renderDialog({ open: true, 'aria-modal': 'false', 'data-state': 'closed' });
    await tick();

    expect(dialog().getAttribute('aria-modal')).toBe('true');
    expect(dialog().getAttribute('data-state')).toBe('open');
  });

  it('falls back to a consumer aria-labelledby when no title is rendered', async () => {
    // Without a `title` the component has no heading to point at, so the
    // consumer's external labelling is the only one there is — the
    // restProps-first spread must not drop it to undefined.
    renderDialog({ open: true, 'aria-labelledby': 'external-heading' });
    await tick();

    expect(dialog().getAttribute('aria-labelledby')).toBe('external-heading');
  });

  it('lets a rendered title own aria-labelledby over a consumer value', async () => {
    renderDialog({ open: true, title: 'Real title', 'aria-labelledby': 'external-heading' });
    await tick();

    const labelledBy = dialog().getAttribute('aria-labelledby');
    expect(labelledBy).not.toBe('external-heading');
    expect(document.getElementById(labelledBy as string)?.textContent).toBe('Real title');
  });

  it('merges a consumer aria-describedby after the internal body id', async () => {
    renderDialog({ open: true, 'aria-describedby': 'external-hint' });
    await tick();

    const ids = (dialog().getAttribute('aria-describedby') as string).split(' ');
    expect(ids).toHaveLength(2);
    // Internal id first, consumer id last: the external hint adds to the
    // dialog's own body description instead of replacing it.
    expect(document.getElementById(ids[0])?.textContent).toContain('Dialog body');
    expect(ids[1]).toBe('external-hint');
  });
});

// The `intent` axis, asserted through the DOM rather than through
// `dialogVariants({ intent })`. It used to be six empty objects: the fold was
// "correct" (it emitted nothing, as configured) while the prop reached no
// element at all. That is the shape of hero-review point 80 — a green variants
// test over a prop that is wired nowhere — so the guard has to be the rendered
// header, not the fold.
describe('Dialog (intent markers)', () => {
  const heading = (name: string) => screen.getByRole('heading', { name, hidden: true });

  it('tints the header title with the intent', async () => {
    renderDialog({ open: true, title: 'Delete project', intent: 'danger' });
    await tick();

    expect(heading('Delete project').className).toContain('text-danger-emphasis');
  });

  it('leaves the title neutral on the default intent', async () => {
    renderDialog({ open: true, title: 'Delete project' });
    await tick();

    // Negative half of the guard: without it a rule that tints unconditionally
    // would pass the test above and still be wrong.
    const className = heading('Delete project').className;
    expect(className).not.toContain('text-danger-emphasis');
    expect(className).toContain('text-text-primary');
  });

  it('never tints the panel surface itself', async () => {
    renderDialog({ open: true, title: 'Delete project', intent: 'danger' });
    await tick();

    // The container rule: markers carry the intent, the surface stays neutral,
    // because arbitrary consumer content sits on it.
    const panel = screen.getByRole('document', { hidden: true });
    expect(panel.className).toContain('bg-surface-overlay');
    expect(panel.className).not.toContain('bg-danger');
    // …and the value is still exposed for consumer CSS.
    expect(panel.getAttribute('data-intent')).toBe('danger');
  });

  it('renders the header icon and hides it from the accessibility tree', async () => {
    renderDialog({
      open: true,
      title: 'Delete project',
      intent: 'danger',
      icon: createRawSnippet(() => ({ render: () => `<svg data-testid="dialog-icon"></svg>` }))
    });
    await tick();

    const icon = screen.getByTestId('dialog-icon');
    const wrapper = icon.parentElement as HTMLElement;
    expect(wrapper.getAttribute('aria-hidden')).toBe('true');
    // The icon takes its colour from the same axis as the title.
    expect(wrapper.className).toContain('text-danger');
  });

  it('drops the icon when there is no title to host it', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog({
      open: true,
      icon: createRawSnippet(() => ({ render: () => `<svg data-testid="dialog-icon"></svg>` }))
    });
    await tick();

    // No structured header exists without a title, so the icon has nowhere to
    // go — the component says so in DEV rather than dropping it silently.
    expect(screen.queryByTestId('dialog-icon')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

// A dialog with every exit disabled is a legitimate pattern (a forced choice),
// so the component must not cry wolf about it — it warns only when there is
// also no action inside, which is the case where the reader is actually stuck.
describe('Dialog (dead-end guard)', () => {
  const sealed = {
    open: true,
    title: 'Terms updated',
    hideCloseButton: true,
    closeOnEscape: false,
    closeOnBackdropClick: false
  } satisfies Partial<DialogProps>;

  /** Only the dead-end line; the init-time "all close paths" note always fires. */
  const deadEndCalls = (warn: { mock: { calls: unknown[][] } }) =>
    warn.mock.calls.filter((c) => String(c[0]).includes('Dead end'));

  it('warns when every exit is closed and nothing inside can act', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog({ ...sealed, children: body('You must accept to continue.') });
    await tick();
    await Promise.resolve();

    expect(deadEndCalls(warn).length).toBe(1);
    warn.mockRestore();
  });

  it('stays quiet when the dialog carries its own action', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog({
      ...sealed,
      children: body('You must accept to continue.'),
      footer: createRawSnippet(() => ({ render: () => `<button type="button">Accept</button>` }))
    });
    await tick();
    await Promise.resolve();

    expect(deadEndCalls(warn).length).toBe(0);
    warn.mockRestore();
  });

  it('stays quiet while any one exit is left open', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderDialog({ ...sealed, closeOnEscape: true, children: body('Read this.') });
    await tick();
    await Promise.resolve();

    expect(deadEndCalls(warn).length).toBe(0);
    warn.mockRestore();
  });
});
