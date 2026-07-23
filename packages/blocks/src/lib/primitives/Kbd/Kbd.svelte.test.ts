// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { KbdProps } from './index';
import Kbd from './Kbd.svelte';

// Render layer for Kbd: the semantic <kbd> element, single vs. multi-key
// rendering with separators, the unstyled contract, and the children override.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: Partial<KbdProps> = {}) {
  const instance = mount(Kbd, {
    target: document.body,
    props: props as KbdProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const root = () => document.querySelector('kbd') as HTMLElement;

describe('Kbd', () => {
  it('renders a semantic <kbd> with a single key label', () => {
    render({ keys: '⌘K' });
    expect(root()).not.toBeNull();
    expect(root().textContent).toBe('⌘K');
    // keycap look applied by default
    expect(root().className).toContain('font-mono');
  });

  it('joins multiple keys with the separator (readable by assistive tech)', () => {
    render({ keys: ['Ctrl', 'K'] });
    // The separator is real, non-hidden text so a screen reader reads the combo.
    expect(root().textContent).toBe('Ctrl+K');
    expect(root().querySelector('[aria-hidden]')).toBeNull();
  });

  it('emits no separator for a single-element array', () => {
    render({ keys: ['Esc'] });
    expect(root().textContent).toBe('Esc');
  });

  it('honours a custom separator', () => {
    render({ keys: ['⌘', 'K'], separator: ' then ' });
    expect(root().textContent).toBe('⌘ then K');
  });

  it('renders an empty keycap for empty keys without throwing', () => {
    render({ keys: [] });
    expect(root()).not.toBeNull();
    expect(root().textContent).toBe('');
  });

  it('strips default styles when unstyled', () => {
    render({ keys: 'K', unstyled: true });
    expect(root().className).not.toContain('font-mono');
    expect(root().className).not.toContain('bg-surface-elevated');
  });

  it('merges a consumer class onto the root', () => {
    render({ keys: 'K', class: 'my-kbd' });
    expect(root().className).toContain('my-kbd');
  });

  it('renders custom children over keys', () => {
    const children = createRawSnippet(() => ({ render: () => '<span>Esc</span>' }));
    render({ keys: 'ignored', children });
    expect(root().textContent).toBe('Esc');
  });
});
