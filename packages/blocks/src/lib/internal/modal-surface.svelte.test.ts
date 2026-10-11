// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Component, ComponentProps, Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dialog from '../primitives/Dialog/Dialog.svelte';
import type { DialogProps } from '../primitives/Dialog/index';
import Drawer from '../primitives/Drawer/Drawer.svelte';
import type { DrawerProps } from '../primitives/Drawer/index';
import { lockBodyScroll } from '../utils/overlay';
import { overlayStack } from '../utils/overlay-stack.svelte';
import ModalFieldHarness from './__fixtures__/ModalFieldHarness.svelte';
import { manualAnimations } from './__fixtures__/manual-animations';
import NestedSurfaceHarness from './__fixtures__/NestedSurfaceHarness.svelte';
import SurfaceHarness from './__fixtures__/SurfaceHarness.svelte';

// The modal-surface contract, run against each component in SURFACES — a new
// consumer of `createModalSurface` belongs in that list: lifecycle (deferred
// showModal, scroll lock, focus in and back out), the dismiss policy (Escape on
// both paths, native cancel/close, backdrop, close button, overlay stack,
// nested surfaces) and the composition of those handlers with a consumer's
// own. What only one surface has — Dialog's `<dialog>`-level backdrop click, its
// drag handle, Drawer's plain `onclick` spread — stays in that component's own
// suite.
//
// Same stack as the component suites: Svelte's own `mount`/`unmount`,
// @testing-library/dom + user-event, native vitest matchers. `showModal()` runs
// a microtask after mount, so tests `await tick()` before interacting.
//
// jsdom's `animate()` stub never finishes, so the panel outro — and with it the
// focus return and lock release at outro end — never completes on its own.
// `transitionDuration: 0` takes Svelte's no-duration path, which ends the
// transition synchronously; the tests that need outro end pass it.
// `manualAnimations()` finishes animations on demand instead, for the tests
// that need an outro which is still running, then ends or is interrupted.

type SurfaceProps = Partial<DialogProps> & Partial<DrawerProps>;

type Surface = {
  name: 'Dialog' | 'Drawer';
  component: Component<SurfaceProps>;
  /**
   * Props under which nothing inside is focusable. An untitled Dialog renders
   * no header at all; Drawer keeps its header, and the close button in it,
   * until `hideCloseButton` drops both.
   */
  noFocusable: SurfaceProps;
};

const SURFACES: Surface[] = [
  { name: 'Dialog', component: Dialog as unknown as Component<SurfaceProps>, noFocusable: {} },
  {
    name: 'Drawer',
    component: Drawer as unknown as Component<SurfaceProps>,
    noFocusable: { hideCloseButton: true }
  }
];

const body = (text = 'Surface body'): Snippet =>
  createRawSnippet(() => ({ render: () => `<p>${text}</p>` }));

const disposers: Array<() => void> = [];

afterEach(() => {
  while (disposers.length) disposers.pop()?.();
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

const escapeKeydown = () =>
  new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });

/** focusFirstElement defers one tick beyond the deferred showDialogModal. */
const settleFocus = async () => {
  await tick();
  await tick();
};

describe.each(SURFACES)('$name (modal surface contract)', ({ name, component, noFocusable }) => {
  // Mounts the object it is given, not a copy: a `$state` props object has to
  // stay the one the component reads, or a later write never reaches it.
  function render(props: SurfaceProps = {}) {
    props.children ??= body();
    const instance = mount(component, { target: document.body, props });
    const dispose = () => unmount(instance);
    disposers.push(dispose);
    flushSync();
    return () => {
      disposers.splice(disposers.indexOf(dispose), 1);
      dispose();
    };
  }

  const surface = () => screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
  const panel = () => screen.getByRole('document', { hidden: true });
  // The dimmed layer is a sibling of the panel, so a click on it never bubbles
  // through panel content — the path both surfaces share.
  const backdrop = () => surface().querySelector(':scope > [role="presentation"]') as HTMLElement;

  describe('lifecycle', () => {
    it('renders open and modal once the deferred showModal has run', async () => {
      render({ open: true, title: 'Filters', children: body('Narrow the list.') });
      await tick();

      const el = surface();
      expect(el.getAttribute('aria-modal')).toBe('true');
      expect(el.getAttribute('data-state')).toBe('open');
      expect(screen.getByRole('heading', { name: 'Filters', hidden: true })).toBeTruthy();
      expect(screen.getByText('Narrow the list.')).toBeTruthy();
      // `dialog.open` reflects that showModal() actually ran. It captures the
      // ref by value, so a call before bind:this assigned it is a silent no-op
      // that leaves the surface never modal.
      expect(el.open).toBe(true);
    });

    it('opens when `open` flips to true after mount', async () => {
      const props = $state<SurfaceProps>({ open: false, children: body() });
      render(props);
      expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();

      props.open = true;
      flushSync();
      await tick();

      expect(surface().open).toBe(true);
      expect(document.body.style.overflow).toBe('hidden');
    });

    it('does not leak a body scroll lock when unmounted before the deferred showModal', async () => {
      const dispose = render({ open: true });
      // Teardown before the opener's tick().then callback has run: bind:this
      // has nulled the ref and onDestroy has already released, so a lock taken
      // in the callback could never be released (module-global refcount).
      dispose();
      await tick();

      expect(document.body.style.overflow).not.toBe('hidden');
    });

    it('unmounting a closed surface leaves a foreign scroll lock intact', async () => {
      // Another overlay holds the module-global lock. Destroying an instance
      // that never locked must not decrement that holder's share.
      const releaseForeign = lockBodyScroll();
      try {
        const dispose = render({ open: false });
        dispose();
        await tick();

        expect(document.body.style.overflow).toBe('hidden');
      } finally {
        releaseForeign();
      }
    });

    it('releases its own lock when destroyed while open, and only its own', async () => {
      const releaseForeign = lockBodyScroll();
      const dispose = render({ open: true });
      await tick();

      // No outro runs on destroy, so the onDestroy release is the only one.
      dispose();
      expect(document.body.style.overflow).toBe('hidden');
      releaseForeign();
      // Still hidden here would mean the destroyed instance kept its share.
      expect(document.body.style.overflow).toBe('');
    });

    it('returns focus to the opener and releases the lock at outro end', async () => {
      const user = userEvent.setup();
      const opener = document.createElement('button');
      opener.textContent = 'Open';
      document.body.appendChild(opener);
      opener.focus();

      render({ open: true, title: 'Filters', transitionDuration: 0 });
      await settleFocus();
      expect(document.activeElement).not.toBe(opener);
      expect(document.body.style.overflow).toBe('hidden');

      await user.keyboard('{Escape}');
      await tick();

      expect(document.activeElement).toBe(opener);
      expect(document.body.style.overflow).toBe('');
      expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    });
  });

  describe('Escape', () => {
    it('fires onClose on Escape (closeOnEscape defaults to true)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, onClose });
      await tick();

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not fire onClose on Escape when closeOnEscape is false', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, closeOnEscape: false, onClose });
      await tick();

      await user.keyboard('{Escape}');

      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('claims Escape at the window level when closeOnEscape is false and focus is outside', async () => {
      // With focus outside the <dialog> the element-level handler never sees
      // the key, and an unclaimed Escape reaches the UA's close watcher, which
      // closes a modal regardless of closeOnEscape. jsdom has no close watcher,
      // so the keydown's defaultPrevented flag is the oracle.
      const onClose = vi.fn();
      render({ open: true, closeOnEscape: false, onClose });
      await settleFocus();
      (document.activeElement as HTMLElement | null)?.blur();
      expect(document.activeElement).toBe(document.body);

      const key = escapeKeydown();
      document.body.dispatchEvent(key);

      expect(key.defaultPrevented).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('stays open when an inner widget already consumed the Escape', async () => {
      // What Select, Combobox, Menu and Popover do when Escape dismisses THEM:
      // handle it and mark it consumed. Select, Combobox and Popover are driven
      // for real further down.
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({
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
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('closes only the top surface of a stack, one per Escape', async () => {
      const onCloseLower = vi.fn();
      const onCloseUpper = vi.fn();
      render({ open: true, onClose: onCloseLower });
      await tick();
      render({ open: true, onClose: onCloseUpper });
      await settleFocus();
      (document.activeElement as HTMLElement | null)?.blur();

      document.body.dispatchEvent(escapeKeydown());
      flushSync();

      expect(onCloseUpper).toHaveBeenCalledOnce();
      expect(onCloseLower).not.toHaveBeenCalled();

      document.body.dispatchEvent(escapeKeydown());
      flushSync();

      expect(onCloseUpper).toHaveBeenCalledOnce();
      expect(onCloseLower).toHaveBeenCalledOnce();
    });

    it('keeps its place in the stack when a lower surface changes its props', async () => {
      // The overlay-stack registration depends on `open` alone. Were it to
      // re-run on another prop, the lower surface would unregister and register
      // again — on top — and the next window Escape would land on it instead.
      const onCloseLower = vi.fn();
      const onCloseUpper = vi.fn();
      const lower = $state<SurfaceProps>({ open: true, onClose: onCloseLower });
      render(lower);
      await tick();
      render({ open: true, onClose: onCloseUpper });
      await settleFocus();
      const top = overlayStack.topId;
      expect(top).not.toBeNull();

      lower.closeOnEscape = false;
      lower.closeOnBackdropClick = false;
      lower.onClose = vi.fn();
      flushSync();

      expect(overlayStack.topId).toBe(top);
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.dispatchEvent(escapeKeydown());
      flushSync();
      expect(onCloseUpper).toHaveBeenCalledOnce();
    });
  });

  describe('native cancel and close', () => {
    it('vetoes the native cancel request when closeOnEscape is false', async () => {
      // Close requests that are not a keydown (back gesture, assistive tech)
      // arrive as a cancelable `cancel` on the <dialog>. jsdom never fires it,
      // so it is dispatched directly and the veto read off defaultPrevented.
      const onClose = vi.fn();
      render({ open: true, closeOnEscape: false, onClose });
      await tick();

      const cancel = new Event('cancel', { cancelable: true });
      surface().dispatchEvent(cancel);

      expect(cancel.defaultPrevented).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('lets the native cancel request through when closeOnEscape is true', async () => {
      render({ open: true });
      await tick();

      const cancel = new Event('cancel', { cancelable: true });
      surface().dispatchEvent(cancel);

      expect(cancel.defaultPrevented).toBe(false);
    });
  });

  describe('pointer dismiss', () => {
    it('fires onClose when the close button is clicked', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      // Titled, no footer: the close control is the only button rendered.
      render({ open: true, title: 'Settings', onClose });
      await tick();

      await user.click(screen.getByRole('button', { hidden: true }));

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('fires onClose on a backdrop click (closeOnBackdropClick defaults to true)', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, onClose });
      await tick();

      await user.click(backdrop());

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not fire onClose on a backdrop click when closeOnBackdropClick is false', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, closeOnBackdropClick: false, onClose });
      await tick();

      await user.click(backdrop());

      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('does not fire onClose when the click originates inside the panel', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, onClose, children: body('Panel content') });
      await tick();

      // A click on content bubbles up to the <dialog>; only a click on the
      // backdrop itself may dismiss.
      await user.click(screen.getByText('Panel content'));

      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });
  });

  // The props reach the shared controller as getters; a value captured at init
  // would keep answering with the mount-time setting. Each test changes a prop
  // after mount and expects the new value to decide.
  describe('props changed after mount', () => {
    it('honours closeOnEscape switched off after mount, on every Escape path', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const props = $state<SurfaceProps>({ open: true, title: 'Settings', onClose });
      render(props);
      await settleFocus();

      props.closeOnEscape = false;
      flushSync();

      await user.keyboard('{Escape}');
      (document.activeElement as HTMLElement | null)?.blur();
      const key = escapeKeydown();
      document.body.dispatchEvent(key);
      const cancel = new Event('cancel', { cancelable: true });
      surface().dispatchEvent(cancel);

      expect(key.defaultPrevented).toBe(true);
      expect(cancel.defaultPrevented).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      expect(surface().getAttribute('data-state')).toBe('open');
    });

    it('honours closeOnEscape switched on after mount', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const props = $state<SurfaceProps>({
        open: true,
        title: 'Settings',
        closeOnEscape: false,
        onClose
      });
      render(props);
      await settleFocus();

      props.closeOnEscape = true;
      flushSync();
      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledOnce();
    });

    it('honours closeOnBackdropClick switched off, then on again, after mount', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const props = $state<SurfaceProps>({ open: true, onClose });
      render(props);
      await tick();

      props.closeOnBackdropClick = false;
      flushSync();
      await user.click(backdrop());
      expect(onClose).not.toHaveBeenCalled();

      props.closeOnBackdropClick = true;
      flushSync();
      await user.click(backdrop());
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls the onClose current at close time, not the one from mount', async () => {
      const user = userEvent.setup();
      const first = vi.fn();
      const second = vi.fn();
      const props = $state<SurfaceProps>({ open: true, onClose: first });
      render(props);
      await tick();

      props.onClose = second;
      flushSync();
      await user.keyboard('{Escape}');

      expect(first).not.toHaveBeenCalled();
      expect(second).toHaveBeenCalledOnce();
    });
  });

  // restProps contract on the <dialog> (docs/COMPONENT-API-CONVENTIONS.md):
  // the spread comes first so internal attributes win, so the behavioural
  // handlers are destructured out and composed — internal first, consumer
  // second. Each test pins both halves, because a regression in either
  // direction is silent.
  describe('consumer handlers composed with the internal ones', () => {
    it('runs a consumer onkeydown and still closes on Escape', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onkeydown = vi.fn();
      // Titled: the opener focuses the close button, so the key starts inside
      // the <dialog> and reaches the element-level handler under test.
      render({ open: true, title: 'Settings', onClose, onkeydown });
      await tick();

      await user.keyboard('{Escape}');

      expect(onkeydown).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('runs a consumer onclose and still routes the native close through onClose', async () => {
      const onClose = vi.fn();
      const onclose = vi.fn();
      render({ open: true, onClose, onclose });
      await tick();

      // The UA fires `close` for its own Escape handling, form[method=dialog]
      // and .close(), each time on a `<dialog>` it has closed already — which
      // jsdom's `close()` stub reproduces.
      surface().close();

      expect(onclose).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('runs a consumer oncancel and still vetoes the request when closeOnEscape is false', async () => {
      const oncancel = vi.fn();
      render({ open: true, closeOnEscape: false, oncancel });
      await tick();

      const cancel = new Event('cancel', { cancelable: true });
      surface().dispatchEvent(cancel);

      expect(oncancel).toHaveBeenCalledOnce();
      expect(cancel.defaultPrevented).toBe(true);
    });

    it('keeps the focus trap intact with a consumer onkeydown present', async () => {
      const onkeydown = vi.fn();
      render({ open: true, title: 'Trapped', onkeydown });
      await tick();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      const notPrevented = surface().dispatchEvent(event);

      // trapFocus preventDefaults when it wraps focus — the signal that the
      // trap engaged rather than leaving the browser to Tab out of the modal.
      expect(notPrevented).toBe(false);
      expect(onkeydown).toHaveBeenCalledOnce();
    });

    it('does not let a consumer preventDefault veto the Escape dismiss', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      render({ open: true, onClose, onkeydown: (event) => event.preventDefault() });
      await tick();

      await user.keyboard('{Escape}');

      // preventDefault is not a veto — `closeOnEscape={false}` is.
      expect(onClose).toHaveBeenCalledOnce();
    });
  });

  // Initial focus — the WCAG 2.1.2 contract. showDialogModal → focusFirstElement
  // moves focus into the panel a tick after showModal(): to the first focusable
  // child when there is one, otherwise to the panel itself, which carries
  // tabindex="-1" for exactly this fallback. jsdom's showModal stub performs no
  // native dialog focusing steps, so everything asserted here is our own focus
  // management.
  describe('initial focus', () => {
    it('focuses the first focusable child when one exists (titled: the close button)', async () => {
      render({ open: true, title: 'Settings' });
      await settleFocus();

      expect(document.activeElement).toBe(screen.getByRole('button', { hidden: true }));
    });

    it('falls back to focusing the panel when nothing inside is focusable', async () => {
      render({ open: true, ...noFocusable });
      await settleFocus();

      expect(document.activeElement).toBe(panel());
      // Programmatically focusable only — never part of the Tab order.
      expect(panel().tabIndex).toBe(-1);
    });

    it('closes on Escape through the element-level handler in the fallback state', async () => {
      const user = userEvent.setup();
      const onClose = vi.fn();
      const onkeydown = vi.fn();
      render({ open: true, ...noFocusable, onClose, onkeydown });
      await settleFocus();

      await user.keyboard('{Escape}');

      // The consumer onkeydown is composed on the <dialog> itself, so its
      // firing proves the key originated inside the surface (panel focus).
      expect(onkeydown).toHaveBeenCalledOnce();
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('traps Tab on the panel when nothing inside is focusable', async () => {
      render({ open: true, ...noFocusable });
      await settleFocus();

      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
      const notPrevented = panel().dispatchEvent(event);

      expect(notPrevented).toBe(false);
      expect(document.activeElement).toBe(panel());
    });
  });

  // The consumer side of the surface: a real `bind:open` (SurfaceHarness), a
  // `setOpen` for the closes a consumer starts itself, and `getOpen` to read
  // `open` between two flushes.
  type Harness = { setOpen: (open: boolean) => void; getOpen: () => boolean };
  function renderHarness(props: Omit<ComponentProps<typeof SurfaceHarness>, 'surface'> = {}) {
    const instance = mount(SurfaceHarness, {
      target: document.body,
      props: { surface: name, ...props }
    });
    disposers.push(() => unmount(instance));
    flushSync();
    return instance as unknown as Harness;
  }

  const closeButton = () => surface().querySelector('header button') as HTMLButtonElement;

  // The optimistic contract of the open-state family on these two surfaces:
  // `onClose` runs with `open` already false, and `open = true` written back
  // inside it — before any flush — leaves the surface exactly as it was. Every
  // path through `requestClose` offers it.
  describe('onClose veto', () => {
    const paths: Record<string, { before?: () => void; act: () => Promise<void> | void }> = {
      'Escape on the surface': { act: () => userEvent.setup().keyboard('{Escape}') },
      'Escape at the window': {
        before: () => (document.activeElement as HTMLElement | null)?.blur(),
        act: () => void document.body.dispatchEvent(escapeKeydown())
      },
      'a backdrop click': { act: () => backdrop().click() },
      'the close button': { act: () => closeButton().click() }
    };

    for (const [path, { before, act }] of Object.entries(paths)) {
      it(`keeps the surface as it was when onClose writes open back, on ${path}`, async () => {
        const onClose = vi.fn();
        const onClosed = vi.fn();
        const harness = renderHarness({
          vetoClose: true,
          onClose,
          onClosed,
          transitionDuration: 0
        });
        await settleFocus();
        before?.();

        const dialog = surface();
        const focused = document.activeElement;
        const stackTop = overlayStack.topId;
        const register = vi.spyOn(overlayStack, 'register');
        const stateWrites: Array<string | null> = [];
        const observer = new MutationObserver((records) => {
          for (const record of records) {
            stateWrites.push((record.target as Element).getAttribute('data-state'));
          }
        });
        observer.observe(dialog, { attributes: true, attributeFilter: ['data-state'] });
        disposers.push(() => observer.disconnect());
        const outroStart = vi.fn();
        panel().addEventListener('outrostart', outroStart);

        await act();
        flushSync();
        await tick();

        // `open` was already false when onClose ran …
        expect(onClose.mock.calls).toEqual([[false]]);
        // … and nothing between that write and the write-back reached the page.
        expect(harness.getOpen()).toBe(true);
        expect(surface()).toBe(dialog);
        expect(dialog.open).toBe(true);
        expect(dialog.getAttribute('data-state')).toBe('open');
        expect(stateWrites).toEqual([]);
        expect(outroStart).not.toHaveBeenCalled();
        expect(onClosed).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(focused);
        expect(document.body.style.overflow).toBe('hidden');
        // Not re-registered, so it has not moved to the top of the stack either.
        expect(register).not.toHaveBeenCalled();
        expect(overlayStack.topId).toBe(stackTop);
      });
    }

    it('cannot veto a close the browser already performed: open goes false again and DEV warns', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onClose = vi.fn();
      const onClosed = vi.fn();
      const harness = renderHarness({ vetoClose: true, onClose, onClosed, transitionDuration: 0 });
      await settleFocus();
      const dialog = surface();

      // form[method=dialog], `dialog.close()` and a close request the browser
      // does not let the page refuse all deliver `close` to a `<dialog>` that is
      // closed already. jsdom's `close()` stub removes `open` and dispatches it.
      dialog.close();

      expect(onClose).toHaveBeenCalledOnce();
      // Never `open === true` over a closed `<dialog>`:
      expect(dialog.open).toBe(false);
      expect(harness.getOpen()).toBe(false);
      const alreadyClosed = warn.mock.calls.filter((call) =>
        String(call[0]).includes('had already closed')
      );
      expect(alreadyClosed).toHaveLength(1);
      expect(alreadyClosed[0][0]).toContain(`[${name}]`);

      flushSync();
      await tick();

      // Nothing re-opens it; the close finishes like any other.
      expect(dialog.open).toBe(false);
      expect(harness.getOpen()).toBe(false);
      expect(onClosed).toHaveBeenCalledOnce();
      expect(screen.queryByRole('dialog', { hidden: true })).toBeNull();
    });

    it('stays quiet on the native-close path when onClose accepts the close', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const harness = renderHarness({ transitionDuration: 0 });
      await settleFocus();

      surface().close();

      expect(harness.getOpen()).toBe(false);
      expect(warn.mock.calls.some((call) => String(call[0]).includes('had already closed'))).toBe(
        false
      );
    });
  });

  describe('onClosed', () => {
    function placeOpener() {
      const opener = document.createElement('button');
      opener.textContent = 'Open';
      document.body.appendChild(opener);
      opener.focus();
      return opener;
    }

    it('fires once the close has finished: dialog closed, lock released, focus back, entry gone', async () => {
      const opener = placeOpener();
      const depthBefore = overlayStack.depth;
      const order: string[] = [];
      let seen: Record<string, unknown> = {};
      const harness = renderHarness({
        transitionDuration: 0,
        onClose: (openInside) => order.push(`onClose open=${openInside}`),
        onClosed: () => {
          order.push('onClosed');
          seen = {
            open: harness.getOpen(),
            dialogOpen: (document.querySelector('dialog') as HTMLDialogElement | null)?.open,
            overflow: document.body.style.overflow,
            active: document.activeElement,
            depth: overlayStack.depth
          };
        }
      });
      await settleFocus();
      expect(document.activeElement).not.toBe(opener);

      await userEvent.setup().keyboard('{Escape}');

      expect(order).toEqual(['onClose open=false', 'onClosed']);
      expect(seen).toEqual({
        open: false,
        dialogOpen: false,
        overflow: '',
        active: opener,
        depth: depthBefore
      });
    });

    it('fires at outro end, not at the close request', async () => {
      const animations = manualAnimations();
      disposers.push(animations.restore);
      const opener = placeOpener();
      const onClose = vi.fn();
      const onClosed = vi.fn();
      renderHarness({ transitionDuration: 100, onClose, onClosed });
      await animations.finish();
      await settleFocus();

      await userEvent.setup().keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledOnce();
      expect(onClosed).not.toHaveBeenCalled();
      expect(surface().contains(document.activeElement)).toBe(true);

      await animations.finish();

      expect(onClosed).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(opener);
    });

    it('fires for a close you start with open = false, which onClose does not report', async () => {
      const onClose = vi.fn();
      const onClosed = vi.fn();
      const harness = renderHarness({ transitionDuration: 0, onClose, onClosed });
      await settleFocus();

      harness.setOpen(false);
      flushSync();

      expect(onClose).not.toHaveBeenCalled();
      expect(onClosed).toHaveBeenCalledOnce();
    });

    it('keeps a focus move made inside it', async () => {
      placeOpener();
      const next = document.createElement('button');
      next.textContent = 'Next';
      document.body.appendChild(next);
      renderHarness({ transitionDuration: 0, onClosed: () => next.focus() });
      await settleFocus();

      await userEvent.setup().keyboard('{Escape}');
      flushSync();
      await settleFocus();

      expect(document.activeElement).toBe(next);
    });

    it('does not fire for a close that a reopen interrupts before the outro ends', async () => {
      const animations = manualAnimations();
      disposers.push(animations.restore);
      const onClosed = vi.fn();
      const harness = renderHarness({ transitionDuration: 100, onClosed });
      await animations.finish();
      await settleFocus();

      await userEvent.setup().keyboard('{Escape}');
      harness.setOpen(true);
      flushSync();
      await animations.finish();

      expect(onClosed).not.toHaveBeenCalled();
      expect(surface().open).toBe(true);
      expect(surface().getAttribute('data-state')).toBe('open');

      // The close that does finish is reported, once.
      harness.setOpen(false);
      flushSync();
      await animations.finish();
      expect(onClosed).toHaveBeenCalledOnce();
    });

    it('does not fire when the surface is destroyed while open', async () => {
      const onClosed = vi.fn();
      const instance = mount(SurfaceHarness, {
        target: document.body,
        props: { surface: name, onClosed, transitionDuration: 0 }
      });
      flushSync();
      await tick();

      unmount(instance);
      flushSync();
      await tick();

      expect(onClosed).not.toHaveBeenCalled();
    });

    it('does not fire when the surface is destroyed during its outro', async () => {
      const animations = manualAnimations();
      disposers.push(animations.restore);
      const onClosed = vi.fn();
      const instance = mount(SurfaceHarness, {
        target: document.body,
        props: { surface: name, onClosed, transitionDuration: 100 }
      });
      flushSync();
      await animations.finish();
      await settleFocus();

      await userEvent.setup().keyboard('{Escape}');
      unmount(instance);
      await animations.finish();

      expect(onClosed).not.toHaveBeenCalled();
    });

    it('fires once for two close requests in one flush', async () => {
      const onClose = vi.fn();
      const onClosed = vi.fn();
      renderHarness({ transitionDuration: 0, onClose, onClosed });
      await settleFocus();

      closeButton().dispatchEvent(escapeKeydown());
      backdrop().click();
      flushSync();
      await tick();

      expect(onClose).toHaveBeenCalledOnce();
      expect(onClosed).toHaveBeenCalledOnce();
    });

    it('fires once per surface for overlayStack.closeAll()', async () => {
      const lower = { onClose: vi.fn(), onClosed: vi.fn() };
      const upper = { onClose: vi.fn(), onClosed: vi.fn() };
      renderHarness({ transitionDuration: 0, ...lower });
      await tick();
      renderHarness({ transitionDuration: 0, ...upper });
      await settleFocus();

      overlayStack.closeAll();
      flushSync();
      await tick();

      for (const spies of [lower, upper]) {
        expect(spies.onClose).toHaveBeenCalledOnce();
        expect(spies.onClosed).toHaveBeenCalledOnce();
      }
    });

    it('fires once for an unbound open that the consumer mirrors in onClose', async () => {
      const onClose = vi.fn();
      const onClosed = vi.fn();
      const props = $state<SurfaceProps>({ open: true, title: 'Settings', transitionDuration: 0 });
      props.onClose = () => {
        onClose();
        props.open = false;
      };
      props.onClosed = onClosed;
      render(props);
      await settleFocus();

      await userEvent.setup().keyboard('{Escape}');
      flushSync();

      expect(onClose).toHaveBeenCalledOnce();
      expect(onClosed).toHaveBeenCalledOnce();
    });

    it('ignores the close event of its own outro-end close() when onClosed has reopened it', async () => {
      const onClose = vi.fn();
      const reopen: { harness?: Harness } = {};
      const onClosed = vi.fn(() => reopen.harness?.setOpen(true));
      const harness = renderHarness({ transitionDuration: 0, onClose, onClosed });
      reopen.harness = harness;
      await settleFocus();
      const first = surface();

      await userEvent.setup().keyboard('{Escape}');
      flushSync();
      await settleFocus();
      expect(onClosed).toHaveBeenCalledOnce();
      expect(harness.getOpen()).toBe(true);
      expect(surface()).toBe(first);
      expect(first.open).toBe(true);

      // A browser's `close()` queues `close` a task later — after onClosed has
      // reopened the surface. jsdom's stub fires it synchronously, inside the
      // close, so the late one is dispatched here.
      first.dispatchEvent(new Event('close'));
      flushSync();

      expect(onClose).toHaveBeenCalledOnce();
      expect(harness.getOpen()).toBe(true);
      expect(first.getAttribute('data-state')).toBe('open');
    });
  });

  describe('DEV warning', () => {
    it('names the component when every close path is disabled', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render({
        open: false,
        hideCloseButton: true,
        closeOnEscape: false,
        closeOnBackdropClick: false
      });

      const lines = warn.mock.calls.map((call) => String(call[0]));
      const closePaths = lines.filter((line) => line.includes('All close paths are disabled'));
      expect(closePaths).toHaveLength(1);
      expect(closePaths[0]).toContain(`[${name}]`);
      expect(closePaths[0]).toContain(`The ${name.toLowerCase()} is only closable`);
    });

    it('stays quiet while any one close path is left open', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      render({ open: false, hideCloseButton: true, closeOnEscape: false });

      expect(warn.mock.calls.some((call) => String(call[0]).includes('All close paths'))).toBe(
        false
      );
    });
  });
});

// One surface inside the other's content: the inner `<dialog>` is a DOM
// descendant of the outer one, so an Escape inside the inner surface reaches the
// outer surface's element-level handler too, and only the inner one may act on
// it. The sibling stack test above cannot show this — its keydowns never meet.
describe.each(
  SURFACES.flatMap(({ name: outer }) => SURFACES.map(({ name: inner }) => ({ outer, inner })))
)('$inner nested inside a $outer', ({ outer, inner }) => {
  async function renderNested(innerCloseOnEscape: boolean) {
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    const instance = mount(NestedSurfaceHarness, {
      target: document.body,
      props: { outer, inner, innerCloseOnEscape, onOuterClose, onInnerClose }
    });
    disposers.push(() => unmount(instance));
    flushSync();
    await settleFocus();

    const innerSurface = screen.getByRole('dialog', { name: 'Inner', hidden: true });
    const outerSurface = screen.getByRole('dialog', { name: 'Outer', hidden: true });
    expect(outerSurface.contains(innerSurface)).toBe(true);
    // The inner close button: focus inside the inner surface, whichever of the
    // two opener ticks moved focus last.
    const innerControl = innerSurface.querySelector('header button') as HTMLElement;
    innerControl.focus();
    return { onOuterClose, onInnerClose, innerSurface, outerSurface };
  }

  it('an Escape inside the inner surface closes the inner one only', async () => {
    const user = userEvent.setup();
    const { onOuterClose, onInnerClose, innerSurface, outerSurface } = await renderNested(true);

    await user.keyboard('{Escape}');

    expect(onInnerClose).toHaveBeenCalledOnce();
    expect(innerSurface.getAttribute('data-state')).toBe('closed');
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(outerSurface.getAttribute('data-state')).toBe('open');
  });

  it('an Escape inside an inner surface that keeps it open closes neither', async () => {
    const user = userEvent.setup();
    const { onOuterClose, onInnerClose, innerSurface, outerSurface } = await renderNested(false);

    await user.keyboard('{Escape}');

    expect(onInnerClose).not.toHaveBeenCalled();
    expect(innerSurface.getAttribute('data-state')).toBe('open');
    expect(onOuterClose).not.toHaveBeenCalled();
    expect(outerSurface.getAttribute('data-state')).toBe('open');
  });
});

// A real field inside a real surface. The raw-snippet test above stands in for
// any widget that consumes its Escape; these drive the two that sit in modal
// forms most often, so a change to either field's keydown handling that stops
// marking the event consumed shows up here as a closed surface.
describe.each(
  SURFACES.flatMap(({ name }) =>
    (['Select', 'Combobox'] as const).map((field) => ({ surface: name, field }))
  )
)('$field inside a $surface', ({ surface, field }) => {
  function render(onClose: () => void) {
    const instance = mount(ModalFieldHarness, {
      target: document.body,
      props: { surface, field, onClose }
    });
    disposers.push(() => unmount(instance));
    flushSync();
  }

  it('swallows its own Escape; the next Escape closes the surface and writes open back', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(onClose);
    await tick();

    const control = screen.getByRole('combobox', { hidden: true });
    await user.click(control);
    expect(control.getAttribute('aria-expanded')).toBe('true');

    await user.keyboard('{Escape}');

    expect(control.getAttribute('aria-expanded')).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { hidden: true }).getAttribute('data-state')).toBe('open');

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('bound-open').textContent).toBe('false');
  });
});

// Popover inside a modal surface leaves the top layer and runs its manual
// dismiss mode (`isAnchoredInModalDialog`) — and, open, joins the overlay
// stack. jsdom has no `:modal`, so the pseudo-class is answered from the `open`
// attribute the showModal stub sets — without it the Popover would stay in
// `auto` mode, where jsdom's no-op showPopover never closes anything, and these
// tests would measure nothing.
function answerModalFromOpenAttribute() {
  const matches = Element.prototype.matches;
  vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
    this: Element,
    selector: string
  ) {
    if (selector === ':modal') return this.tagName === 'DIALOG' && this.hasAttribute('open');
    return matches.call(this, selector);
  });
}

type FieldHarness = { closeSurface: () => void; hideField: () => void };

describe.each(SURFACES)('Popover inside a $name', ({ name: surface }) => {
  beforeEach(answerModalFromOpenAttribute);

  async function openPopover(props: Partial<ComponentProps<typeof ModalFieldHarness>> = {}) {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFieldOpenChange = vi.fn();
    const onFieldEscape = vi.fn();
    const instance = mount(ModalFieldHarness, {
      target: document.body,
      props: { surface, field: 'Popover', onClose, onFieldOpenChange, onFieldEscape, ...props }
    });
    disposers.push(() => unmount(instance));
    flushSync();
    await settleFocus();

    const triggerButton = screen.getByRole('button', { name: 'Operator', hidden: true });
    await user.click(triggerButton);
    expect(screen.getByTestId('field-open').textContent).toBe('true');
    // The precondition the tests are about: inside the surface the panel is
    // not promoted to the top layer, so Escape is not the browser's to handle.
    const panel = screen.getByRole('dialog', { name: 'Operator options', hidden: true });
    expect(panel.hasAttribute('popover')).toBe(false);
    const harness = instance as unknown as FieldHarness;
    return { user, onClose, onFieldOpenChange, onFieldEscape, triggerButton, harness };
  }

  const surfaceState = () =>
    screen.getByRole('dialog', { name: 'Filters', hidden: true }).getAttribute('data-state');

  for (const focus of ['trigger', 'panel'] as const) {
    it(`swallows its own Escape with focus on the ${focus}; the next Escape closes the surface`, async () => {
      const { user, onClose, onFieldOpenChange, onFieldEscape, triggerButton } =
        await openPopover();
      if (focus === 'panel') screen.getByRole('button', { name: 'Inside', hidden: true }).focus();

      await user.keyboard('{Escape}');

      expect(screen.getByTestId('field-open').textContent).toBe('false');
      expect(onFieldOpenChange.mock.calls).toEqual([[true], [false]]);
      expect(onFieldEscape).toHaveBeenCalledOnce();
      expect(document.activeElement).toBe(triggerButton);
      expect(onClose).not.toHaveBeenCalled();
      expect(surfaceState()).toBe('open');

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledOnce();
      expect(screen.getByTestId('bound-open').textContent).toBe('false');
      expect(onFieldOpenChange).toHaveBeenCalledTimes(2);
      expect(onFieldEscape).toHaveBeenCalledOnce();
    });
  }

  it('closes alone on an Escape from another control of the surface; the next Escape closes the surface', async () => {
    const { user, onClose, onFieldOpenChange, onFieldEscape } = await openPopover();
    screen.getByRole('button', { name: 'Elsewhere', hidden: true }).focus();

    await user.keyboard('{Escape}');

    expect(screen.getByTestId('field-open').textContent).toBe('false');
    expect(onFieldOpenChange.mock.calls).toEqual([[true], [false]]);
    expect(onFieldEscape).toHaveBeenCalledOnce();
    expect(onClose).not.toHaveBeenCalled();
    expect(surfaceState()).toBe('open');

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('bound-open').textContent).toBe('false');
    expect(onFieldEscape).toHaveBeenCalledOnce();
  });

  it('joins the overlay stack above the surface while open, and leaves it when it closes', async () => {
    const base = overlayStack.depth;
    const { user } = await openPopover();

    expect(overlayStack.depth).toBe(base + 2);
    expect(overlayStack.topId).toMatch(/^popover-/);

    await user.keyboard('{Escape}');

    expect(overlayStack.depth).toBe(base + 1);
    expect(overlayStack.topId).toMatch(new RegExp(`^${surface.toLowerCase()}-`));
  });

  it('leaves the stack when it unmounts while open', async () => {
    const base = overlayStack.depth;
    const { harness } = await openPopover();

    harness.hideField();
    flushSync();

    expect(overlayStack.depth).toBe(base + 1);
    expect(overlayStack.topId).toMatch(new RegExp(`^${surface.toLowerCase()}-`));
  });

  it('leaves the stack when the surface closes underneath it', async () => {
    const base = overlayStack.depth;
    const { harness } = await openPopover({ transitionDuration: 0 });

    harness.closeSurface();
    flushSync();
    await tick();

    expect(screen.queryByRole('dialog', { name: 'Filters', hidden: true })).toBeNull();
    expect(overlayStack.depth).toBe(base);
  });

  it('is closed first by overlayStack.closeAll(), the surface after it', async () => {
    const order: string[] = [];
    const { onFieldEscape } = await openPopover({
      onClose: () => order.push('surface onClose'),
      onFieldOpenChange: (open) => order.push(`popover onOpenChange(${open})`)
    });

    overlayStack.closeAll();
    flushSync();

    expect(order).toEqual([
      'popover onOpenChange(true)',
      'popover onOpenChange(false)',
      'surface onClose'
    ]);
    expect(screen.getByTestId('field-open').textContent).toBe('false');
    expect(onFieldEscape).not.toHaveBeenCalled();
  });

  it('leaves an Escape to a surface opened above it', async () => {
    const { onClose, onFieldOpenChange } = await openPopover();
    const onUpperClose = vi.fn();
    const upper = mount(SurfaceHarness, {
      target: document.body,
      props: { surface, title: 'Upper', onClose: onUpperClose }
    });
    disposers.push(() => unmount(upper));
    flushSync();
    await settleFocus();
    expect(overlayStack.topId).toMatch(new RegExp(`^${surface.toLowerCase()}-`));
    (document.activeElement as HTMLElement | null)?.blur();

    document.body.dispatchEvent(escapeKeydown());
    flushSync();

    expect(onUpperClose).toHaveBeenCalledOnce();
    expect(screen.getByTestId('field-open').textContent).toBe('true');
    expect(onFieldOpenChange.mock.calls).toEqual([[true]]);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('with closeOnEscape off, holds an Escape from another control: neither closes', async () => {
    const { onClose, onFieldOpenChange } = await openPopover({ fieldCloseOnEscape: false });
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere', hidden: true });
    elsewhere.focus();

    const key = escapeKeydown();
    elsewhere.dispatchEvent(key);
    flushSync();

    // Claimed: left unclaimed, it would reach the browser's close watcher,
    // which closes a modal `<dialog>` whatever its closeOnEscape says — the
    // part of a real browser jsdom does not model, so the flag is the oracle.
    expect(key.defaultPrevented).toBe(true);
    expect(screen.getByTestId('field-open').textContent).toBe('true');
    expect(onFieldOpenChange.mock.calls).toEqual([[true]]);
    expect(onClose).not.toHaveBeenCalled();
    expect(surfaceState()).toBe('open');
  });
});

// Menu and DatePicker open a Popover of their own, so inside a modal surface
// they run its manual mode and join the overlay stack through it.
describe.each(
  SURFACES.flatMap(({ name }) =>
    (['Menu', 'DatePicker'] as const).map((field) => ({ surface: name, field }))
  )
)('$field inside a $surface', ({ surface, field }) => {
  beforeEach(answerModalFromOpenAttribute);

  const expanded = () =>
    (field === 'Menu'
      ? screen.getByRole('button', { name: /Operator/, hidden: true })
      : screen.getByRole('button', { name: 'Open calendar', hidden: true })
    ).getAttribute('aria-expanded');

  const surfaceState = () =>
    screen.getByRole('dialog', { name: 'Filters', hidden: true }).getAttribute('data-state');

  async function openField() {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const instance = mount(ModalFieldHarness, {
      target: document.body,
      props: { surface, field, onClose }
    });
    disposers.push(() => unmount(instance));
    flushSync();
    await settleFocus();

    if (field === 'Menu') {
      await user.click(screen.getByRole('button', { name: /Operator/, hidden: true }));
    } else {
      screen.getByRole('textbox', { hidden: true }).focus();
      await user.keyboard('{ArrowDown}');
    }
    expect(expanded()).toBe('true');
    return { user, onClose };
  }

  it('takes its own Escape; the next Escape closes the surface', async () => {
    const { user, onClose } = await openField();

    await user.keyboard('{Escape}');

    expect(expanded()).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
    expect(surfaceState()).toBe('open');

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes alone on an Escape from another control of the surface', async () => {
    const { user, onClose } = await openField();
    screen.getByRole('button', { name: 'Elsewhere', hidden: true }).focus();

    await user.keyboard('{Escape}');

    expect(expanded()).toBe('false');
    expect(onClose).not.toHaveBeenCalled();
    expect(surfaceState()).toBe('open');
  });
});

// The condition is a modal `<dialog>`, not the library's own surfaces: a
// consumer's `<dialog>` opened with `showModal()` puts the Popover in manual
// mode too, and nothing of ours unmounts the Popover when it closes.
describe('Popover inside a plain modal <dialog>', () => {
  beforeEach(answerModalFromOpenAttribute);

  it('joins the overlay stack while open and leaves it when the <dialog> closes under it', async () => {
    const base = overlayStack.depth;
    const instance = mount(ModalFieldHarness, {
      target: document.body,
      props: { surface: 'native', field: 'Popover' }
    });
    disposers.push(() => unmount(instance));
    flushSync();
    const dialog = screen.getByRole('dialog', {
      name: 'Filters',
      hidden: true
    }) as HTMLDialogElement;
    expect(dialog.open).toBe(true);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Operator', hidden: true }));
    expect(screen.getByTestId('field-open').textContent).toBe('true');
    expect(overlayStack.depth).toBe(base + 1);

    dialog.close();
    flushSync();

    expect(overlayStack.depth).toBe(base);
  });
});
