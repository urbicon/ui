// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Component, Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Dialog from '../primitives/Dialog/Dialog.svelte';
import type { DialogProps } from '../primitives/Dialog/index';
import Drawer from '../primitives/Drawer/Drawer.svelte';
import type { DrawerProps } from '../primitives/Drawer/index';
import { lockBodyScroll } from '../utils/overlay';
import { overlayStack } from '../utils/overlay-stack.svelte';
import ModalFieldHarness from './__fixtures__/ModalFieldHarness.svelte';
import NestedSurfaceHarness from './__fixtures__/NestedSurfaceHarness.svelte';

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
      // and .close(). jsdom does not, so it is dispatched directly.
      surface().dispatchEvent(new Event('close'));

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
// dismiss mode (`isAnchoredInModalDialog`). jsdom has no `:modal`, so the
// pseudo-class is answered from the `open` attribute the showModal stub sets —
// without it the Popover would stay in `auto` mode, where jsdom's no-op
// showPopover never closes anything, and these tests would measure nothing.
describe.each(SURFACES)('Popover inside a $name', ({ name: surface }) => {
  beforeEach(() => {
    const matches = Element.prototype.matches;
    vi.spyOn(Element.prototype, 'matches').mockImplementation(function (
      this: Element,
      selector: string
    ) {
      if (selector === ':modal') return this.tagName === 'DIALOG' && this.hasAttribute('open');
      return matches.call(this, selector);
    });
  });

  async function openPopover() {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onFieldOpenChange = vi.fn();
    const onFieldEscape = vi.fn();
    const instance = mount(ModalFieldHarness, {
      target: document.body,
      props: { surface, field: 'Popover', onClose, onFieldOpenChange, onFieldEscape }
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
    return { user, onClose, onFieldOpenChange, onFieldEscape, triggerButton };
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
});
