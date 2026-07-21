// @vitest-environment jsdom
import { tick } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { focusFirstElement } from './overlay';

/**
 * Focus-move contract of `focusFirstElement`, isolated from any overlay
 * component (the Dialog fallback suite asserts the same mechanics through a
 * mounted Dialog). jsdom per-file: the function reads and writes real DOM
 * focus. The third case is the c788469 review finding: a consumer that has
 * already focused a `tabindex="-1"` element inside the container (the
 * focus-the-heading pattern) must keep that focus — the selector excludes
 * `tabindex="-1"`, so without the contains-guard the empty-list fallback
 * stole it a tick later.
 */
describe('focusFirstElement', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  const settle = async () => {
    // focusFirstElement defers its move by one tick.
    await tick();
    await tick();
  };

  function mountContainer(innerHTML: string): HTMLElement {
    const container = document.createElement('div');
    container.tabIndex = -1;
    container.innerHTML = innerHTML;
    document.body.appendChild(container);
    return container;
  }

  it('focuses the first focusable descendant', async () => {
    const container = mountContainer('<p>static</p><button>close</button>');
    focusFirstElement(container);
    await settle();

    expect(document.activeElement).toBe(container.querySelector('button'));
  });

  it('falls back to the container itself when nothing inside is focusable', async () => {
    const container = mountContainer('<p>static only</p>');
    focusFirstElement(container);
    await settle();

    expect(document.activeElement).toBe(container);
  });

  it('leaves a consumer-focused tabindex="-1" element alone instead of stealing to the panel', async () => {
    const container = mountContainer('<h2 tabindex="-1">Heading</h2><p>static</p>');
    const heading = container.querySelector<HTMLElement>('h2');
    heading?.focus();
    expect(document.activeElement).toBe(heading);

    focusFirstElement(container);
    await settle();

    expect(document.activeElement).toBe(heading);
  });

  it('leaves consumer focus alone even when focusable descendants exist', async () => {
    const container = mountContainer('<h2 tabindex="-1">Heading</h2><button>ok</button>');
    container.querySelector<HTMLElement>('h2')?.focus();

    focusFirstElement(container);
    await settle();

    expect(document.activeElement).toBe(container.querySelector('h2'));
  });

  it('still moves focus when the active element sits outside the container', async () => {
    const outside = document.createElement('button');
    outside.textContent = 'trigger';
    document.body.appendChild(outside);
    outside.focus();
    const container = mountContainer('<button>inside</button>');

    focusFirstElement(container);
    await settle();

    expect(document.activeElement).toBe(container.querySelector('button'));
  });
});
