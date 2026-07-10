// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TooltipProps } from './index';
import Tooltip from './Tooltip.svelte';

// Interaction layer for Tooltip — the open/close contract after the move to
// `open` (bindable) + `onOpenChange` (P1 open-state vocabulary): hover/focus
// drive the state through the show/hide delays, Escape dismisses, and
// `bind:open` gives programmatic control ("Copied!" feedback). Same stack as
// the other DOM tests: Svelte's own `mount`/`unmount`, @testing-library/dom +
// user-event, native vitest matchers. jsdom has no top layer, so these tests
// assert state + aria wiring (aria-describedby pairing), not visual visibility
// — that is Playwright's (`e2e/tooltip-motion`) job.
//
// Delays are set to 0 so `show()`/`hide()` resolve on the next macrotask; the
// tests flush with a real 0ms sleep instead of fake timers (user-event and
// fake timers interact poorly without `advanceTimers` plumbing).

const flushTimeouts = () => new Promise((resolve) => setTimeout(resolve, 1));

const triggerContent = (): Snippet =>
  createRawSnippet(() => ({ render: () => `<button>Save</button>` }));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderTooltip(props: Partial<TooltipProps> & { label: string }) {
  const instance = mount(Tooltip, {
    target: document.body,
    props: { children: triggerContent(), showDelay: 0, hideDelay: 0, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

const trigger = () => screen.getByRole('button', { name: 'Save' });
const tooltip = () => screen.getByRole('tooltip', { hidden: true });

describe('Tooltip (component interaction)', () => {
  it('opens on hover, pairs aria-describedby, and reports through onOpenChange', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderTooltip({ label: 'Save your changes', onOpenChange });

    const wrapper = trigger().parentElement as HTMLElement;
    expect(wrapper.getAttribute('aria-describedby')).toBeNull();

    await user.hover(trigger());
    await flushTimeouts();
    flushSync();

    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);
    expect(wrapper.getAttribute('aria-describedby')).toBe(tooltip().id);

    await user.unhover(trigger());
    await flushTimeouts();
    flushSync();

    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(wrapper.getAttribute('aria-describedby')).toBeNull();
  });

  it('closes on Escape and fires onOpenChange(false) once', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderTooltip({ label: 'Save your changes', onOpenChange });

    // Focus-open path (keyboard modality).
    trigger().focus();
    await flushTimeouts();
    flushSync();
    expect(onOpenChange).toHaveBeenNthCalledWith(1, true);

    await user.keyboard('{Escape}');
    flushSync();
    expect(onOpenChange).toHaveBeenNthCalledWith(2, false);

    // The pending hide timeout from a later blur must not double-report —
    // setOpen's no-change guard keeps it quiet.
    trigger().blur();
    await flushTimeouts();
    flushSync();
    expect(onOpenChange).toHaveBeenCalledTimes(2);
  });

  it('supports programmatic display via the bindable open prop without echoing onOpenChange', async () => {
    const onOpenChange = vi.fn();
    renderTooltip({ label: 'Copied!', open: true, onOpenChange });
    flushSync();

    // Mounted open: aria pairing is live, but the consumer's own write is
    // not echoed back through the callback.
    const wrapper = trigger().parentElement as HTMLElement;
    expect(wrapper.getAttribute('aria-describedby')).toBe(tooltip().id);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
