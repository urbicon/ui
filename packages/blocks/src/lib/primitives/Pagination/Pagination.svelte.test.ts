// @vitest-environment jsdom
import { screen } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PaginationItemContext, PaginationProps } from './index';
import Pagination from './Pagination.svelte';

// Interaction layer for the `renderItem` snippet (PAG-3). Pagination is
// declarative — no context children — so the snippet is supplied with
// `createRawSnippet`; its `setup` hook wires a real click handler onto the
// custom node so the `select` callback can be exercised end-to-end. Same stack
// as the Dialog/Combobox tests: Svelte's own mount/unmount, @testing-library/dom
// + user-event, native vitest matchers.

let dispose: (() => void) | undefined;

afterEach(() => {
  dispose?.();
  dispose = undefined;
  document.body.replaceChildren();
});

// A custom page button that surfaces the forwarded context on data-* attributes
// and calls `select` on click, so both the render contract and the callback are
// observable from the DOM.
const renderItem = createRawSnippet<[PaginationItemContext]>((ctx) => ({
  render: () =>
    `<button data-testid="custom-page" data-page="${ctx().page}" data-active="${ctx().active}" data-intent="${ctx().intent}">${ctx().page}</button>`,
  setup: (node) => {
    const onClick = () => ctx().select();
    node.addEventListener('click', onClick);
    return () => node.removeEventListener('click', onClick);
  }
}));

function renderPagination(props: Partial<PaginationProps> = {}) {
  const instance = mount(Pagination, {
    target: document.body,
    props: { currentPage: 2, totalPages: 5, ...props } as PaginationProps
  });
  dispose = () => unmount(instance);
  flushSync();
}

describe('Pagination — renderItem snippet', () => {
  it('replaces the default numbered buttons and forwards page/active/intent context', () => {
    renderPagination({ currentPage: 2, totalPages: 5, intent: 'success', renderItem });

    const custom = screen.getAllByTestId('custom-page');
    // 5 pages, all visible under the default visiblePages window.
    expect(custom.map((el) => el.getAttribute('data-page'))).toEqual(['1', '2', '3', '4', '5']);
    // The active page reflects currentPage; intent is forwarded verbatim.
    expect(
      custom.find((el) => el.getAttribute('data-active') === 'true')?.getAttribute('data-page')
    ).toBe('2');
    expect(custom[0].getAttribute('data-intent')).toBe('success');
  });

  it('drives page changes through the select callback', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, renderItem, onPageChange });

    const page4 = screen
      .getAllByTestId('custom-page')
      .find((el) => el.getAttribute('data-page') === '4');
    await userEvent.click(page4!);
    expect(onPageChange).toHaveBeenCalledWith(4);
  });

  it('select is a no-op for the already-active page', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, renderItem, onPageChange });

    const page2 = screen
      .getAllByTestId('custom-page')
      .find((el) => el.getAttribute('data-page') === '2');
    await userEvent.click(page2!);
    expect(onPageChange).not.toHaveBeenCalled();
  });
});
