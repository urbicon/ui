// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EmptyState from './EmptyState.svelte';
import type { EmptyStateProps } from './index';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: EmptyStateProps) {
  const instance = mount(EmptyState, { target: document.body, props });
  dispose = () => unmount(instance);
  flushSync();
}

const heading = (text: string) =>
  [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].find(
    (h) => h.textContent?.trim() === text
  );

describe('EmptyState heading rank', () => {
  it('renders the title as h3 by default', () => {
    render({ title: 'Nothing yet' });
    expect(heading('Nothing yet')?.tagName).toBe('H3');
  });

  it('renders the title at the requested rank without changing its classes', () => {
    render({ title: 'Default rank' });
    const defaultClasses = heading('Default rank')?.className;
    dispose?.();
    document.body.replaceChildren();

    render({ title: 'Under the h1', headingLevel: 2 });
    const title = heading('Under the h1');
    expect(title?.tagName).toBe('H2');
    expect(title?.className).toBe(defaultClasses);
  });
});
