// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { printSelector } from '../__fixtures__/print-scope';
import Spinner from './Spinner.svelte';

// Spinner hides itself in print. The subject is the reach of that rule, and
// both halves are asked of a real system: the Svelte compiler says which
// selector ships (see the helper for how the scope class is derived), jsdom's
// own matcher says which elements it takes.

const PRINT_SELECTOR = printSelector(import.meta.dirname, 'Spinner.svelte');

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderSpinner() {
  const instance = mount(Spinner, { target: document.body });
  dispose = () => unmount(instance);
  flushSync();
  return document.body.firstElementChild as HTMLElement;
}

describe('Spinner — the print rule reaches the spinner and nothing else', () => {
  it('takes the rendered spinner root', () => {
    expect(renderSpinner().matches(PRINT_SELECTOR)).toBe(true);
  });

  it('leaves a role="status" element the spinner did not render', () => {
    // Every polite Alert and every `Badge purpose="status"` is one of these. An
    // unscoped rule here hides them all from print, in every app that imports
    // Spinner anywhere.
    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'status');
    document.body.append(foreign);

    expect(foreign.matches(PRINT_SELECTOR)).toBe(false);
  });
});
