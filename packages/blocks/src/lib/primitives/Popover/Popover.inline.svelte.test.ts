// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import Popover from './Popover.svelte';

/**
 * The other half of `inline` mode: the panel has to come **back**.
 *
 * `Popover.phrasing.smoke.test.ts` asserts the server output, and every one of
 * its cases is about something being absent. Three of them pass on empty output
 * — rendering with `inline: true` and no `trigger` snippet emits nothing but
 * comment markers, which contains no `<div>`, no `popover=` and no
 * `role="dialog"` either. So a regression that left `hydrated` permanently false
 * would keep that whole file green, and the existing `Popover.svelte.test.ts`
 * green too, since those cases all run the default mode.
 *
 * That regression is precisely the one the mode's reasoning is about: the flag
 * is deliberately false during the first client render, and the entire
 * correctness argument is that it flips right afterwards. These cases are what
 * make the flip observable.
 */

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

const trigger = createRawSnippet(() => ({ render: () => '<button>cite</button>' }));
const children = createRawSnippet(() => ({ render: () => '<span>the source</span>' }));

function mountPopover(props: Record<string, unknown> = {}) {
  const instance = mount(Popover, {
    target: document.body,
    props: { trigger, children, ...props }
  });
  dispose = () => unmount(instance);
  flushSync();
}

/** jsdom has no top layer, so the panel is only reachable with `hidden: true`. */
const panel = () => screen.queryByRole('dialog', { hidden: true });

describe('Popover inline mode — after mount', () => {
  it('renders the panel once mounted', () => {
    mountPopover({ inline: true });
    expect(panel(), 'the panel must return after onMount flips `hydrated`').not.toBeNull();
  });

  it('opens on click and shows its content', async () => {
    const user = userEvent.setup();
    mountPopover({ inline: true });
    await user.click(screen.getByRole('button', { name: 'cite' }));
    flushSync();
    expect(panel()?.getAttribute('data-state')).toBe('open');
    expect(document.body.textContent).toContain('the source');
  });

  it('keeps the trigger wrapper a span while the panel is a div', () => {
    // Both halves of the mode, asserted on the live DOM rather than on the
    // server string: the wrapper carries the click handling, so a wrong tag here
    // would be a behaviour change, not only a markup one.
    mountPopover({ inline: true });
    const wrapper = screen.getByRole('button', { name: 'cite' }).parentElement;
    expect(wrapper?.tagName).toBe('SPAN');
    expect(panel()?.tagName).toBe('DIV');
  });

  it('binds the panel element, so the floating machinery can reach it', () => {
    // `bind:this={popoverElement}` now points at a node that does not exist on
    // the first render. Everything downstream (useFloatingPanel, the toggle
    // listener) is `$effect`-driven and re-runs when it appears — this asserts
    // it actually did, rather than the binding having captured `null` for good.
    mountPopover({ inline: true });
    expect(panel()?.getAttribute('data-state')).toBe('closed');
    expect(panel()?.hasAttribute('inert')).toBe(true);
  });

  it('behaves the same as the default mode once mounted', async () => {
    // The mode is about SSR output only. If it also changed client behaviour,
    // adopting it would be a trade rather than a fix.
    const user = userEvent.setup();
    mountPopover({});
    await user.click(screen.getByRole('button', { name: 'cite' }));
    flushSync();
    const asDefault = panel()?.getAttribute('data-state');
    dispose?.();
    document.body.replaceChildren();

    mountPopover({ inline: true });
    await user.click(screen.getByRole('button', { name: 'cite' }));
    flushSync();
    expect(panel()?.getAttribute('data-state')).toBe(asDefault);
  });
});
