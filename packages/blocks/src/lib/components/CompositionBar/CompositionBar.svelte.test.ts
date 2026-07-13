// @vitest-environment jsdom
import { type ComponentProps, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import CompositionBar from './CompositionBar.svelte';

// Accessibility contract of the bar root: a named group, not role="img" — img
// flattens the subtree in the accessibility tree and would hide the interactive
// segment <button>s from screen readers. Repo stack: svelte's own
// mount/unmount, native matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderBar(props: ComponentProps<typeof CompositionBar>) {
  const instance = mount(CompositionBar, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

describe('CompositionBar (accessibility contract)', () => {
  it('exposes the bar as a named group with its interactive segments', () => {
    renderBar({
      items: [
        { label: 'Gas', value: 60 },
        { label: 'Power', value: 40 }
      ]
    });

    const bar = document.querySelector('[role="group"]');
    expect(bar).not.toBeNull();
    expect(bar?.getAttribute('aria-label')).toBeTruthy();
    // The segments stay perceivable as individual buttons inside the group.
    expect(bar?.querySelectorAll('button[data-composition-segment]').length).toBe(2);
  });
});
