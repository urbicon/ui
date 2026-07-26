// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyStateHarness from './__fixtures__/CopyStateHarness.svelte';

// createCopyState registers an $effect teardown, so it can only run inside a
// component — hence the harness rather than a bare function call.

let writeText: ReturnType<typeof vi.fn>;
let dispose: (() => void) | undefined;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true
  });
});

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function render(props: { timeoutMs?: number } = {}) {
  const state = $state(props);
  const instance = mount(CopyStateHarness, { target: document.body, props: state });
  dispose = () => unmount(instance);
  flushSync();
  return state;
}

const phase = () => document.querySelector('[data-phase]')!.getAttribute('data-phase');
const trigger = () => document.querySelector('button') as HTMLButtonElement;

// Two microtask turns: one for the clipboard write the module awaits, one for
// the caller's own `await copyState.copy(...)` to resume and record the result.
async function flush() {
  await Promise.resolve();
  await Promise.resolve();
  flushSync();
}

describe('createCopyState', () => {
  it('advances to copied on a successful write and reverts on the timer', async () => {
    vi.useFakeTimers();
    render();
    expect(phase()).toBe('idle');

    trigger().click();
    await flush();
    expect(writeText).toHaveBeenCalledWith('payload');
    expect(phase()).toBe('copied');

    vi.advanceTimersByTime(1999);
    await flush();
    expect(phase(), 'still pinned just before the timeout').toBe('copied');

    vi.advanceTimersByTime(1);
    await flush();
    expect(phase()).toBe('idle');
  });

  it('advances to error and reverts on the same timer', async () => {
    vi.useFakeTimers();
    writeText.mockRejectedValueOnce(new Error('denied'));
    render();

    trigger().click();
    await flush();
    expect(phase()).toBe('error');

    vi.advanceTimersByTime(2000);
    await flush();
    expect(phase()).toBe('idle');
  });

  /**
   * A non-secure context has no `navigator.clipboard` at all. Reading
   * `.writeText` off undefined would throw a TypeError out of the handler
   * instead of landing in the error phase.
   */
  it('reaches the error phase when the Clipboard API is absent entirely', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    render();

    trigger().click();
    await flush();
    expect(phase()).toBe('error');
  });

  it('returns the outcome to the caller rather than invoking a captured callback', async () => {
    render();
    trigger().click();
    await flush();
    expect(document.querySelector('[data-last-result]')?.getAttribute('data-last-result')).toBe(
      'ok'
    );

    writeText.mockRejectedValueOnce(new Error('denied'));
    trigger().click();
    await flush();
    expect(document.querySelector('[data-last-result]')?.getAttribute('data-last-result')).toBe(
      'failed'
    );
  });

  /**
   * The regression this module was built to prevent. `timeout` is read through a
   * getter, so a prop change after init takes effect. Passing the number
   * directly froze it at its first value — the Svelte compiler flags that shape
   * as "only captures the initial value", and it shipped twice before.
   */
  it('honours a timeout changed after initialisation', async () => {
    vi.useFakeTimers();
    const props = render({ timeoutMs: 2000 });

    props.timeoutMs = 500;
    flushSync();

    trigger().click();
    await flush();
    expect(phase()).toBe('copied');

    vi.advanceTimersByTime(500);
    await flush();
    expect(phase(), 'reverted on the NEW timeout, not the initial one').toBe('idle');
  });

  it('keeps the outcome pinned when the timeout is zero', async () => {
    vi.useFakeTimers();
    render({ timeoutMs: 0 });

    trigger().click();
    await flush();
    expect(phase()).toBe('copied');

    vi.advanceTimersByTime(60_000);
    await flush();
    expect(phase(), 'no revert was scheduled').toBe('copied');
  });

  it('restarts the revert timer on a second copy instead of stacking timers', async () => {
    vi.useFakeTimers();
    render();

    trigger().click();
    await flush();
    vi.advanceTimersByTime(1500);
    await flush();
    expect(phase()).toBe('copied');

    // Second copy at t=1500 — the revert must be measured from here, so the
    // first timer has to have been cleared.
    trigger().click();
    await flush();
    vi.advanceTimersByTime(600);
    await flush();
    expect(phase(), 'the first timer did not fire early').toBe('copied');

    vi.advanceTimersByTime(1400);
    await flush();
    expect(phase()).toBe('idle');
  });

  it('clears a pending revert on unmount so it cannot fire into a dead component', async () => {
    vi.useFakeTimers();
    render();

    trigger().click();
    await flush();
    expect(phase()).toBe('copied');

    dispose?.();
    dispose = undefined;
    // Would throw / warn on a state write to a destroyed component if the
    // teardown were missing.
    expect(() => {
      vi.advanceTimersByTime(5000);
      flushSync();
    }).not.toThrow();
  });
});
