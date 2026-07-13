// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PopoverProps } from './index';
import Popover from './Popover.svelte';

// Interaction layer for Popover — trigger toggling, the manual-mode dismiss
// matrix (Escape / outside-pointerdown, each gated by its closeOn* prop), the
// external-trigger (autoTrigger=false) anti-flicker contract, and the
// onOpenChange/onEscape/onClickOutside discrimination.
//
// jsdom has no top layer and never light-dismisses: with all defaults the
// component runs in native `popover="auto"` mode where the BROWSER owns
// Escape/outside dismiss and reports it via `toggle` events. Those paths are
// exercised here by dispatching the toggle signal the browser would emit (the
// component's discrimination logic is real; only the emitter is simulated) —
// real light-dismiss behaviour is Playwright's job. The manual-mode paths
// (any closeOn* false / external trigger) use the component's own document
// listeners and are driven organically. Outside-click sequences use fireEvent
// (pointerdown-based logic; user-event's single-pointer model can false-pass).
// Content queries use data-testid / `{ hidden: true }` semantics per the
// repo's popover convention.

// Content carries a focusable control so the focus-restore tests can move
// focus INTO the panel before dismissing — otherwise the trigger is trivially
// still focused from the opening click and the assertion proves nothing.
const content = (): Snippet =>
  createRawSnippet(() => ({
    render: () =>
      '<div data-testid="pop-content">Body<button data-testid="inner-btn">Inner</button></div>'
  }));
const triggerSnippet = (): Snippet =>
  createRawSnippet(() => ({ render: () => '<button type="button">Open</button>' }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderPopover(props: Partial<PopoverProps> = {}) {
  const instance = mount(Popover, {
    target: document.body,
    props: { children: content(), trigger: triggerSnippet(), ...props } as PopoverProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('button', { name: 'Open' });
const isOpen = () => screen.queryByTestId('pop-content') !== null;
const panel = () => document.querySelector('[role="dialog"]') as HTMLElement;

// The browser reports native (auto-mode) dismisses via a `toggle` event on the
// popover element; jsdom never emits it, so tests dispatch the equivalent.
const dispatchNativeDismiss = () => {
  const ev = new Event('toggle');
  Object.assign(ev, { newState: 'closed', oldState: 'open' });
  panel().dispatchEvent(ev);
  flushSync();
};

describe('Popover (trigger)', () => {
  it('opens on trigger click and wires aria-expanded/aria-haspopup onto the interactive trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    const btn = trigger();
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    expect(btn.getAttribute('aria-haspopup')).toBe('dialog');
    expect(isOpen()).toBe(false);

    await user.click(btn);

    expect(isOpen()).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('toggles via keyboard (Enter opens, Space closes)', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ onOpenChange });

    trigger().focus();
    await user.keyboard('{Enter}');
    expect(isOpen()).toBe(true);
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);

    await user.keyboard(' ');
    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('closes on a second trigger click in manual mode (no native light dismiss to rely on)', async () => {
    // With closeOnClickOutside=false the popover runs popover="manual": the
    // browser never light-dismisses, so the trigger click itself must
    // toggle-close. Regression: dismissedByTrigger used to be armed in manual
    // mode too, swallowing the closing click — the trigger could never close
    // its own popover.
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPopover({ closeOnClickOutside: false, onOpenChange });

    await user.click(trigger());
    expect(isOpen()).toBe(true);

    await user.click(trigger());
    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });
});

describe('Popover (manual-mode dismiss matrix)', () => {
  it('Escape closes, fires onEscape + onOpenChange(false), and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onEscape = vi.fn();
    renderPopover({ closeOnClickOutside: false, onOpenChange, onEscape });

    await user.click(trigger());
    // Move focus into the panel first — the realistic pre-dismiss state.
    screen.getByTestId('inner-btn').focus();
    await user.keyboard('{Escape}');

    expect(isOpen()).toBe(false);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    // Focus restore must land on the interactive trigger, not the (non-
    // focusable) wrapper div — a plain div.focus() is a spec no-op, which
    // would strand focus on body once the panel content unmounts.
    expect(document.activeElement).toBe(trigger());
  });

  it('outside pointerdown does NOT close when closeOnClickOutside is false', async () => {
    const user = userEvent.setup();
    const onClickOutside = vi.fn();
    renderPopover({ closeOnClickOutside: false, onClickOutside });

    await user.click(trigger());
    fireEvent.pointerDown(document.body);
    flushSync();

    expect(isOpen()).toBe(true);
    expect(onClickOutside).not.toHaveBeenCalled();
  });

  it('outside pointerdown closes and fires onClickOutside; Escape stays inert when closeOnEscape is false', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onClickOutside = vi.fn();
    const onEscape = vi.fn();
    renderPopover({ closeOnEscape: false, onOpenChange, onClickOutside, onEscape });

    await user.click(trigger());

    // Escape is vetoed…
    await user.keyboard('{Escape}');
    expect(isOpen()).toBe(true);
    expect(onEscape).not.toHaveBeenCalled();

    // …a pointerdown inside the panel is not "outside"…
    fireEvent.pointerDown(screen.getByTestId('pop-content'));
    flushSync();
    expect(isOpen()).toBe(true);

    // …but a genuine outside pointerdown dismisses.
    fireEvent.pointerDown(document.body);
    flushSync();
    expect(isOpen()).toBe(false);
    expect(onClickOutside).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
  });

  it('excludes an external trigger from outside-dismiss (anti close-then-reopen flicker)', () => {
    // autoTrigger=false forces manual mode; the consumer owns `open` and the
    // trigger element. A pointerdown on that trigger must NOT count as
    // outside — otherwise the popover closes on pointerdown and the
    // consumer's click toggle re-opens it (the mobile flicker).
    const btn = document.createElement('button');
    btn.textContent = 'External';
    document.body.appendChild(btn);
    const onOpenChange = vi.fn();
    const onClickOutside = vi.fn();
    renderPopover({
      trigger: undefined,
      triggerElement: btn,
      autoTrigger: false,
      open: true,
      onOpenChange,
      onClickOutside
    });

    expect(isOpen()).toBe(true);

    fireEvent.pointerDown(btn);
    flushSync();
    expect(isOpen()).toBe(true);
    expect(onClickOutside).not.toHaveBeenCalled();

    fireEvent.pointerDown(document.body);
    flushSync();
    expect(isOpen()).toBe(false);
    expect(onClickOutside).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe('Popover (auto-mode native dismiss)', () => {
  it('discriminates a native Escape dismiss: onEscape fires, focus returns to the trigger', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    const onEscape = vi.fn();
    const onClickOutside = vi.fn();
    renderPopover({ onOpenChange, onEscape, onClickOutside });

    await user.click(trigger());
    // Move focus into the panel first — the realistic pre-dismiss state.
    screen.getByTestId('inner-btn').focus();
    // The capture-phase keydown probe marks the pending Escape; the browser
    // would then close the popover and emit the toggle we dispatch here.
    await user.keyboard('{Escape}');
    dispatchNativeDismiss();

    expect(isOpen()).toBe(false);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(onEscape).toHaveBeenCalledOnce();
    expect(onClickOutside).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(trigger());
  });

  it('discriminates a native light dismiss: onClickOutside fires, not onEscape', async () => {
    const user = userEvent.setup();
    const onEscape = vi.fn();
    const onClickOutside = vi.fn();
    renderPopover({ onEscape, onClickOutside });

    await user.click(trigger());
    dispatchNativeDismiss();

    expect(isOpen()).toBe(false);
    expect(onClickOutside).toHaveBeenCalledOnce();
    expect(onEscape).not.toHaveBeenCalled();
  });
});
