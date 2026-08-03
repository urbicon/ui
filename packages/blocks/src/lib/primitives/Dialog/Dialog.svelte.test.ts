// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lockBodyScroll } from '../../utils/overlay';
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

  it('does not leak a body scroll lock when unmounted before the deferred showModal', async () => {
    renderDialog({ open: true });
    // Tear down before the opener effect's tick().then callback has run: the
    // unmount nulls dialogEl and onDestroy has already unlocked, so an
    // unguarded callback would lockBodyScroll() with nothing ever unlocking —
    // the whole page stays overflow:hidden (module-global refcount).
    dispose?.();
    dispose = undefined;
    await tick();

    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('unmounting a closed dialog leaves a foreign scroll lock intact', async () => {
    // Another overlay (here: a manual acquisition of the same module-global
    // lock) is holding the body scroll. Destroying a dialog that never locked
    // must not decrement that holder's share — the old unconditional
    // onDestroy unlock did exactly that.
    const releaseForeign = lockBodyScroll();
    try {
      renderDialog({ open: false });
      dispose?.();
      dispose = undefined;
      await tick();

      expect(document.body.style.overflow).toBe('hidden');
    } finally {
      releaseForeign();
    }
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

  it('stays open when an inner widget already consumed the Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderDialog({
      open: true,
      onClose,
      children: createRawSnippet(() => ({
        render: () => `<button type="button" data-testid="inner">Operator</button>`
      }))
    });
    await tick();

    // Exactly what Select, Combobox and Popover do when Escape dismisses THEM:
    // handle it and mark it consumed. The dialog's own handler ignored that and
    // closed anyway, so dismissing an open dropdown tore down the dialog it sat
    // in — the case Codeberg #23 put a Select into in the first place.
    const inner = screen.getByTestId('inner');
    inner.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') event.preventDefault();
    });
    inner.focus();

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

// Draggable mode (DLG-4). The header is the drag handle; dragging translates the
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
});

// restProps contract on the <dialog> (see docs/COMPONENT-API-CONVENTIONS.md).
// Dialog spreads {...restProps} FIRST so its own attributes win, which alone
// would clobber a consumer's DOM handlers — the exact bug pointed the other
// way. So the three behavioural handlers are destructured out and composed:
// internal first (unconditional), consumer second. These tests pin both halves
// — the consumer's handler runs AND the internal dismiss/focus/close path
// survives — because a regression in either direction is silent.
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

  it('runs a consumer onkeydown and still closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onkeydown = vi.fn();
    // Titled: the opener focuses the close button, so the key event starts
    // inside the dialog and reaches the element-level handler under test. (The
    // untitled case goes through the panel-focus fallback instead — asserted
    // in the initial-focus suite below.)
    renderDialog({ open: true, title: 'Settings', onClose, onkeydown });
    await tick();

    await user.keyboard('{Escape}');

    expect(onkeydown).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('runs a consumer onclose and still routes the native close through onClose', async () => {
    const onClose = vi.fn();
    const onclose = vi.fn();
    renderDialog({ open: true, onClose, onclose });
    await tick();

    // The UA fires `close` for its own ESC handling / form[method=dialog] /
    // .close(). jsdom does not, so dispatch it directly.
    dialog().dispatchEvent(new Event('close'));

    expect(onclose).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps the focus trap intact with a consumer onkeydown present', async () => {
    const onkeydown = vi.fn();
    renderDialog({ open: true, title: 'Trapped', onkeydown });
    await tick();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const notPrevented = dialog().dispatchEvent(event);

    // trapFocus preventDefaults when it wraps focus — dispatchEvent returning
    // false is the signal that the trap engaged rather than the browser being
    // left to Tab out of the modal.
    expect(notPrevented).toBe(false);
    expect(onkeydown).toHaveBeenCalledOnce();
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

// Initial focus — the WCAG 2.1.2 contract. showDialogModal → focusFirstElement
// moves focus into the panel a tick after showModal(): to the first focusable
// child when one exists, otherwise — an untitled dialog with static children
// renders no header, hence no close button — to the panel itself, which carries
// tabindex="-1" for exactly this fallback. Without it, focus stayed on <body>:
// the <dialog>'s element-level keydown never fired, ESC only worked through the
// svelte:window fallback, and the Tab trap was inert until the user clicked in.
// jsdom's showModal polyfill performs no native dialog focusing steps (see
// vitest-setup.ts), so everything asserted here is our own focus management.
// Real Tab traversal across several focusables, top-layer inertness, and
// focus restore on close need a browser — that remains Playwright's job.
describe('Dialog (initial focus + no-focusable fallback)', () => {
  const panel = () => screen.getByRole('document', { hidden: true });

  // focusFirstElement defers by one more tick after the opener effect's own
  // deferred showDialogModal, so focus assertions settle after two awaits.
  const settleFocus = async () => {
    await tick();
    await tick();
  };

  it('focuses the first focusable child when one exists (titled: the close button)', async () => {
    renderDialog({ open: true, title: 'Settings' });
    await settleFocus();

    // Guard in both directions: a real focusable wins, the panel fallback
    // must not steal focus from it.
    expect(document.activeElement).toBe(screen.getByRole('button', { hidden: true }));
  });

  it('falls back to focusing the panel when children contain nothing focusable', async () => {
    renderDialog({ open: true });
    await settleFocus();

    expect(document.activeElement).toBe(panel());
    // Programmatically focusable only — the fallback target never joins the
    // Tab order (getFocusableElements excludes tabindex="-1").
    expect((panel() as HTMLElement).tabIndex).toBe(-1);
  });

  it('closes on Escape through the element-level handler in the fallback state', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onkeydown = vi.fn();
    renderDialog({ open: true, onClose, onkeydown });
    await settleFocus();

    await user.keyboard('{Escape}');

    // The consumer onkeydown is composed on the <dialog> element itself, so
    // its firing proves the key event originated inside the dialog (panel
    // focus). Pre-fallback, focus stayed on <body> and only the window-level
    // listener closed — the element handler never ran.
    expect(onkeydown).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('traps Tab on the panel when nothing inside is focusable', async () => {
    renderDialog({ open: true });
    await settleFocus();

    const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    const notPrevented = panel().dispatchEvent(event);

    // With zero focusables, trapFocus parks focus on the panel instead of
    // letting Tab walk out of the modal — defaultPrevented is the signal that
    // the trap engaged. (Cycling across several focusables is asserted via the
    // titled trap test in the restProps suite + Playwright.)
    expect(notPrevented).toBe(false);
    expect(document.activeElement).toBe(panel());
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
