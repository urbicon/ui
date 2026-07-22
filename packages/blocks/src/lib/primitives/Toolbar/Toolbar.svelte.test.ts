// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import type { Snippet } from 'svelte';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import type { ToolbarProps } from './index';
import Toolbar from './Toolbar.svelte';

// Interaction layer for Toolbar — the container's restProps-first contract
// (COMPONENT-API-CONVENTIONS §restProps ordering): the computed
// role/aria-orientation/aria-label survive adversarial restProps, while
// legitimate native and data-* attributes pass through. Toolbar is a
// declarative primitive (children render via snippet, no context
// registration), so the content is a createRawSnippet of plain HTML — no
// fixture needed (Dialog-suite pattern). Same stack as the Combobox pilot:
// Svelte's own mount/unmount, @testing-library/dom, native vitest matchers.

const content: Snippet = createRawSnippet(() => ({
  render: () => '<button type="button">Bold</button>'
}));

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderToolbar(props: Partial<ToolbarProps> = {}) {
  const instance = mount(Toolbar, {
    target: document.body,
    props: { 'aria-label': 'Formatting', children: content, ...props } as ToolbarProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

const toolbar = () => screen.getByRole('toolbar');

describe('Toolbar (restProps-first contract on the container)', () => {
  it('renders role=toolbar, labelled by the required aria-label, reflecting its orientation', () => {
    renderToolbar({ orientation: 'vertical' });

    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    expect(toolbar().getAttribute('aria-orientation')).toBe('vertical');
  });

  it('consumer role via restProps cannot override role="toolbar"', () => {
    renderToolbar({ role: 'menu' });

    expect(screen.getByRole('toolbar', { name: 'Formatting' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('internal aria-orientation wins against a contradicting restProps value', () => {
    // orientation defaults to horizontal — always defined, so the computed
    // value beats a consumer 'aria-orientation' smuggled through restProps.
    renderToolbar({ 'aria-orientation': 'vertical' });

    expect(toolbar().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('lets legitimate restProps through: data-*, id, aria-labelledby', () => {
    renderToolbar({
      'data-analytics': 'format-bar',
      id: 'fmt-toolbar',
      'aria-labelledby': 'external-heading'
    });

    const el = toolbar();
    expect(el.getAttribute('data-analytics')).toBe('format-bar');
    expect(el.id).toBe('fmt-toolbar');
    // aria-labelledby is not component-owned — it survives the spread.
    expect(el.getAttribute('aria-labelledby')).toBe('external-heading');
  });
});
