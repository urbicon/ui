// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CopyButtonPhaseHarness from './__fixtures__/CopyButtonPhaseHarness.svelte';
import CopyButton from './CopyButton.svelte';
import type { CopyButtonProps } from './index';

// Render + behaviour layer for CopyButton: clipboard write, success/error state,
// the polite status announcement, the accessible name across modes, timer reset,
// timeout=0, and the disabled guard.

let dispose: (() => void) | undefined;
let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true
  });
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<CopyButtonProps> = {}) {
  const instance = mount(CopyButton, {
    target: document.body,
    props: { value: 'copied text', ...props } as CopyButtonProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const button = () => screen.getByRole('button');
const status = () => document.querySelector('[role="status"]') as HTMLElement;

// Flush the async clipboard handler (a resolved promise) then Svelte's reactive
// graph, without advancing fake timers beyond 0.
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
  flushSync();
}

describe('CopyButton', () => {
  it('is icon-only with a stable "Copy" accessible name by default', () => {
    render();
    expect(button().getAttribute('aria-label')).toBe('Copy');
    expect(document.querySelector('svg')).not.toBeNull();
    expect(status().textContent).toBe('');
  });

  it('writes the value and announces the copy through the polite status region', async () => {
    const onCopy = vi.fn();
    render({ onCopy });
    await fireEvent.click(button());
    await settle();
    expect(writeText).toHaveBeenCalledWith('copied text');
    expect(onCopy).toHaveBeenCalledWith('copied text');
    expect(status().textContent).toBe('Copied');
    // The button's accessible name stays stable; the outcome rides the live region.
    expect(button().getAttribute('aria-label')).toBe('Copy');
  });

  it('reverts to idle after the timeout', async () => {
    render({ timeout: 2000 });
    await fireEvent.click(button());
    await settle();
    expect(status().textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(2000);
    flushSync();
    expect(status().textContent).toBe('');
  });

  it('re-arms the timeout on a second copy instead of reverting early', async () => {
    render({ timeout: 2000 });
    await fireEvent.click(button());
    await settle();
    await vi.advanceTimersByTimeAsync(1000);
    flushSync();
    await fireEvent.click(button());
    await settle();
    // 1500 ms past the second copy (2500 ms past the first) — still copied
    // only if the first timer was cleared.
    await vi.advanceTimersByTimeAsync(1500);
    flushSync();
    expect(status().textContent).toBe('Copied');
    await vi.advanceTimersByTimeAsync(500);
    flushSync();
    expect(status().textContent).toBe('');
  });

  it('keeps the copied state indefinitely when timeout is 0', async () => {
    render({ timeout: 0 });
    await fireEvent.click(button());
    await settle();
    await vi.advanceTimersByTimeAsync(60_000);
    flushSync();
    expect(status().textContent).toBe('Copied');
  });

  it('surfaces a clipboard failure through onError and the status region', async () => {
    const onError = vi.fn();
    writeText.mockRejectedValueOnce(new Error('denied'));
    render({ onError });
    await fireEvent.click(button());
    await settle();
    expect(onError).toHaveBeenCalledOnce();
    expect(status().textContent).toBe('Copy failed');
  });

  it('does not write to the clipboard when disabled', async () => {
    render({ disabled: true });
    await fireEvent.click(button());
    await settle();
    expect(writeText).not.toHaveBeenCalled();
    expect(status().textContent).toBe('');
  });

  it('uses the visible label as the accessible name in labelled mode', () => {
    render({ label: 'Copy key' });
    // No aria-label override — the visible text is the name (WCAG 2.5.3).
    expect(button().hasAttribute('aria-label')).toBe(false);
    expect(button().textContent).toContain('Copy key');
  });

  it('swaps the visible label to the copied text on success', async () => {
    render({ label: 'Copy key', copiedLabel: 'Copied!' });
    await fireEvent.click(button());
    await settle();
    expect(button().textContent).toContain('Copied!');
  });

  it('lets a consumer override the icon-only accessible name', () => {
    render({ 'aria-label': 'Copy token' });
    expect(button().getAttribute('aria-label')).toBe('Copy token');
  });
});

// `children` — the grammar fix from hero-review point 28. `label` stays the
// string shorthand; the snippet is what makes CopyButton fillable like any
// other Button (icon + text, a Kbd, …), which was the one place the "inherits
// the full button styling vocabulary" claim did not hold.
describe('CopyButton (children)', () => {
  const content = (text: string) =>
    createRawSnippet(() => ({ render: () => `<span>${text}</span>` }));

  it('renders children instead of the label shorthand', () => {
    render({ label: 'Copy key', children: content('Copy API key') });

    expect(screen.getByText('Copy API key')).toBeTruthy();
    expect(screen.queryByText('Copy key')).toBeNull();
  });

  it('lets the visible content be the accessible name', () => {
    render({ children: content('Copy API key') });

    // Icon-only mode imposes aria-label="Copy"; visible content must not, or it
    // would override what the user can read (WCAG 2.5.3).
    expect(button().getAttribute('aria-label')).toBeNull();
  });

  it('hands the copy phase to the snippet and updates it on copy', async () => {
    // Mounted from a fixture, not `createRawSnippet`: a raw snippet renders its
    // string once and never reads the argument again, so it reports 'idle'
    // forever and would pass a weaker assertion while the wiring was dead.
    const instance = mount(CopyButtonPhaseHarness, { target: document.body });
    dispose = () => unmount(instance);
    flushSync();

    const phase = () => screen.getByTestId('phase').textContent;
    expect(phase()).toBe('idle');

    fireEvent.click(button());
    await settle();

    expect(phase()).toBe('copied');
  });
});
