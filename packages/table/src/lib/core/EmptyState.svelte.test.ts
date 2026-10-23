// @vitest-environment jsdom
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import EmptyState, { type EmptyStateProps } from './EmptyState.svelte';

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function render(props: EmptyStateProps): HTMLElement {
  const table = document.createElement('table');
  const tbody = document.createElement('tbody');
  table.append(tbody);
  document.body.append(table);
  const instance = mount(EmptyState, { target: tbody, props });
  dispose = () => unmount(instance);
  flushSync();
  return tbody;
}

describe('EmptyState icon', () => {
  it.each(['search', 'database', 'inbox'] as const)('draws the library icon for %s', (icon) => {
    const target = render({ icon });
    expect(target.querySelectorAll('svg')).toHaveLength(1);
  });

  it('renders a snippet', () => {
    const icon = createRawSnippet(() => ({
      render: () => '<span data-testid="own-icon">★</span>'
    }));
    const target = render({ icon });
    expect(target.querySelector('[data-testid="own-icon"]')).not.toBeNull();
  });

  it('takes no markup string: a type error, and a throw instead of HTML at runtime', () => {
    const markup = '<img src=x onerror="window.__emptyStateXss = true">';
    // @ts-expect-error a string other than the three icon names is not an icon
    const props: EmptyStateProps = { icon: markup };
    expect(() => render(props)).toThrow();
    expect(document.querySelector('img')).toBeNull();
  });
});
