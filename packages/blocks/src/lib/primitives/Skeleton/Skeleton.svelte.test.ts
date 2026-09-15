// @vitest-environment jsdom
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { printSelector } from '../__fixtures__/print-scope';
import Skeleton from './Skeleton.svelte';

// A skeleton stands in for content that has not arrived; on paper it is a row
// of grey bars, so it hides itself in print the way Spinner does. Same two
// halves, same reason: the compiler says which selector ships, jsdom says
// which elements it takes.

const PRINT_SELECTOR = printSelector(import.meta.dirname, 'Skeleton.svelte');

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

function renderSkeleton(count?: number) {
  const instance = mount(Skeleton, { target: document.body, props: count ? { count } : {} });
  dispose = () => unmount(instance);
  flushSync();
  return document.body.firstElementChild as HTMLElement;
}

describe('Skeleton — the print rule reaches the skeleton and nothing else', () => {
  it('takes the single-bar root', () => {
    expect(renderSkeleton().matches(PRINT_SELECTOR)).toBe(true);
  });

  it('takes the wrapper root a multi-bar skeleton renders instead', () => {
    // `count > 1` renders a different root; both carry `role="status"` and both
    // have to be covered, or a multi-line skeleton prints its bars.
    expect(renderSkeleton(3).matches(PRINT_SELECTOR)).toBe(true);
  });

  it('leaves a role="status" element the skeleton did not render', () => {
    const foreign = document.createElement('div');
    foreign.setAttribute('role', 'status');
    document.body.append(foreign);

    expect(foreign.matches(PRINT_SELECTOR)).toBe(false);
  });
});
