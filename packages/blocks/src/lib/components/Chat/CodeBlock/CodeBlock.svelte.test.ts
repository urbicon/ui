// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/dom';
import { flushSync, mount, tick, unmount } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CodeBlock from './CodeBlock.svelte';
import type { CodeBlockProps } from './index';

// Interaction layer for CodeBlock — the copy contract (clipboard write, icon +
// label swap, 2s revert, onCopy) plus the structural rules (header gating, wrap
// classes, scrollable-region a11y). Same stack as the Combobox/Dialog pilots:
// Svelte's own mount/unmount, @testing-library/dom, native vitest matchers.
//
// navigator.clipboard is not implemented in jsdom, so we install a mock
// writeText per test. copyCode() calls writeText synchronously, then awaits it;
// the `copied` flip happens in the resolution microtask, so we `await flush()`
// (a microtask + a Svelte tick) before asserting DOM that depends on it.

let writeText: ReturnType<typeof vi.fn>;

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true
  });
});

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function render(props: Partial<CodeBlockProps> = {}) {
  const instance = mount(CodeBlock, {
    target: document.body,
    props: { code: 'const x = 1;', ...props } as CodeBlockProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

async function flush() {
  await Promise.resolve();
  await tick();
  flushSync();
}

// The copy control is icon-only — its accessible name IS its state label, which
// is why the matcher covers all three phases.
const copyButton = () => screen.getByRole('button', { name: /^(copy|copied|copy failed)$/i });
const region = () => screen.getByRole('region');

describe('CodeBlock (component interaction)', () => {
  it('writes the exact code to the clipboard on copy click', async () => {
    render({ code: 'echo "hello world"' });
    fireEvent.click(copyButton());
    // writeText is invoked synchronously inside the handler, before the await.
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith('echo "hello world"');
  });

  it('swaps icon + label to the copied state and reverts after 2s', async () => {
    vi.useFakeTimers();
    render();

    const btn = copyButton();
    const svgBefore = btn.querySelector('svg')?.outerHTML;
    // Icon-only: the label lives on the accessible name, not in the text content.
    expect(btn.getAttribute('aria-label')).toBe('Copy');
    expect(btn.getAttribute('title')).toBe('Copy');

    fireEvent.click(btn);
    await flush();

    expect(screen.getByRole('button', { name: 'Copied' })).toBeTruthy();
    // Icon swapped (copy → check) — the rendered svg markup differs.
    const svgAfter = copyButton().querySelector('svg')?.outerHTML;
    expect(svgAfter).not.toBe(svgBefore);
    // Live status region announces the confirmation.
    expect(screen.getByRole('status').textContent).toBe('Copied');

    vi.advanceTimersByTime(2000);
    await flush();

    expect(copyButton().getAttribute('aria-label')).toBe('Copy');
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('uses custom copyLabel / copiedLabel', async () => {
    render({ copyLabel: 'Kopieren', copiedLabel: 'Kopiert' });
    fireEvent.click(screen.getByRole('button', { name: 'Kopieren' }));
    await flush();
    expect(screen.getByRole('button', { name: 'Kopiert' })).toBeTruthy();
  });

  it('fires onCopy with the code after a successful copy', async () => {
    const onCopy = vi.fn();
    render({ code: 'abc123', onCopy });
    fireEvent.click(copyButton());
    await flush();
    expect(onCopy).toHaveBeenCalledWith('abc123');
  });

  /**
   * A failed copy used to be console-only: the button stayed on its idle label,
   * so a user with a denied clipboard permission saw no difference between
   * "copied" and "did nothing". It now reports the failure like any other
   * outcome — and still never falsely confirms.
   */
  it('reports a failed clipboard write instead of looking untouched', async () => {
    vi.useFakeTimers();
    writeText.mockRejectedValueOnce(new Error('denied'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCopy = vi.fn();
    render({ onCopy });

    fireEvent.click(copyButton());
    await flush();

    expect(screen.getByRole('button', { name: 'Copy failed' })).toBeTruthy();
    // Announced too — an icon swap alone reaches nobody using a screen reader.
    expect(screen.getByRole('status').textContent).toBe('Copy failed');
    // No false confirmation, and the success callback stays untouched.
    expect(onCopy).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();

    // Reverts on the same timer as a success, so the control returns to rest.
    vi.advanceTimersByTime(2000);
    await flush();
    expect(copyButton().getAttribute('aria-label')).toBe('Copy');
  });

  it('routes a failure to onCopyError instead of the console when handled', async () => {
    writeText.mockRejectedValueOnce(new Error('denied'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onCopyError = vi.fn();
    render({ onCopyError });

    fireEvent.click(copyButton());
    await flush();

    expect(onCopyError).toHaveBeenCalledTimes(1);
    expect((onCopyError.mock.calls[0][0] as Error).message).toBe('denied');
    // A handled failure is not also console noise.
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('scrolls horizontally by default and soft-wraps when wrap=true', () => {
    render({ wrap: false });
    expect(region().className).toContain('overflow-x-auto');
    dispose?.();
    document.body.replaceChildren();

    render({ wrap: true });
    expect(region().className).toContain('whitespace-pre-wrap');
    expect(region().className).not.toContain('overflow-x-auto');
  });

  it('omits the header entirely when there is no lang, no copy button, and no actions', () => {
    render({ showCopy: false });
    expect(screen.queryByRole('button')).toBeNull();
    // Root's first child is the code region — no header div precedes it.
    const root = region().parentElement;
    expect(root?.firstElementChild).toBe(region());
  });

  it('shows the header when only lang is provided (no copy button)', () => {
    render({ lang: 'ts', showCopy: false });
    expect(screen.queryByRole('button')).toBeNull();
    // Header present: the region is not the first child.
    const root = region().parentElement;
    expect(root?.firstElementChild).not.toBe(region());
    expect(root?.textContent).toContain('ts');
  });

  it('applies slotClasses to root and pre', () => {
    render({ slotClasses: { root: 'my-root', pre: 'my-pre' } });
    expect(region().className).toContain('my-pre');
    expect(region().parentElement?.className).toContain('my-root');
  });

  /**
   * `label` is what an embedding parent passes ("Input"). It replaces `lang` in
   * the header rather than joining it — a header reading "Input" over a block
   * captioned "json" states the same payload twice, which is exactly the doubled
   * chrome the embedded variant removes.
   */
  it('shows label instead of lang in the header when both are given', () => {
    render({ lang: 'json', label: 'Input', showCopy: false });
    const root = region().parentElement!;
    expect(root.textContent).toContain('Input');
    expect(root.textContent).not.toContain('json');
  });

  it('shows the header for a label alone, and omits it when neither is given', () => {
    render({ label: 'Input', showCopy: false });
    expect(region().parentElement?.firstElementChild).not.toBe(region());
    dispose?.();
    document.body.replaceChildren();

    render({ showCopy: false });
    expect(region().parentElement?.firstElementChild).toBe(region());
  });

  it('labels the scrollable region by language, falling back to label then "Code"', () => {
    render({ lang: 'python' });
    expect(region().getAttribute('aria-label')).toBe('python code');
    dispose?.();
    document.body.replaceChildren();

    // The language stays the region's name even when the header shows a caption:
    // "json code" tells a screen-reader user more than "Input code".
    render({ lang: 'json', label: 'Input' });
    expect(region().getAttribute('aria-label')).toBe('json code');
    dispose?.();
    document.body.replaceChildren();

    render({ label: 'Input' });
    expect(region().getAttribute('aria-label')).toBe('Input code');
    dispose?.();
    document.body.replaceChildren();

    render();
    expect(region().getAttribute('aria-label')).toBe('Code');
  });

  it('renders the raw code as the text content of the pre/code', () => {
    render({ code: 'a < b && c > d' });
    expect(region().textContent).toBe('a < b && c > d');
  });
});
