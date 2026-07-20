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

// Default-button interaction contract: onPageChange wiring for page numbers /
// Previous / Next / First / Last, unified edge behaviour (every layout keeps
// Previous/Next mounted and disables the dead-end arrow rather than unmounting it),
// aria-current on the active page, the windowed-ellipsis rendering, and the global
// `disabled` gate.
describe('Pagination — page-change contract', () => {
  const pageButton = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

  it('marks only the active page with aria-current="page"', () => {
    renderPagination({ currentPage: 2, totalPages: 5 });

    expect(pageButton('2').getAttribute('aria-current')).toBe('page');
    expect(pageButton('3').getAttribute('aria-current')).toBeNull();
    // The nav landmark carries the localized label.
    expect(screen.getByRole('navigation', { name: 'Page navigation' })).toBeTruthy();
  });

  it('clicking a page number fires onPageChange; the active page is a no-op', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, onPageChange });

    await userEvent.click(pageButton('4'));
    expect(onPageChange).toHaveBeenCalledWith(4);

    await userEvent.click(pageButton('2'));
    expect(onPageChange).toHaveBeenCalledOnce();
  });

  it('Previous/Next navigate relative to the current page', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 3, totalPages: 5, onPageChange });

    await userEvent.click(pageButton('Previous'));
    expect(onPageChange).toHaveBeenLastCalledWith(2);

    await userEvent.click(pageButton('Next'));
    expect(onPageChange).toHaveBeenLastCalledWith(4);
  });

  it('default layout keeps Previous/Next mounted at the edges and disables the dead end', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 1, totalPages: 5, onPageChange });

    // Page 1: Previous is IN the DOM but disabled (unified edge policy — no unmount,
    // hence no layout shift and no focus loss); Next stays live.
    const prevOnFirst = pageButton('Previous');
    expect(prevOnFirst.disabled).toBe(true);
    expect(pageButton('Next').disabled).toBe(false);
    // Clicking the dead-end arrow is inert — the native disabled attribute and the
    // handlePageChange range guard both suppress it.
    await userEvent.click(prevOnFirst);
    expect(onPageChange).not.toHaveBeenCalled();

    dispose?.();
    document.body.replaceChildren();

    // Last page: symmetric — Next is present-but-disabled, Previous is live.
    renderPagination({ currentPage: 5, totalPages: 5, onPageChange });
    const nextOnLast = pageButton('Next');
    expect(nextOnLast.disabled).toBe(true);
    expect(pageButton('Previous').disabled).toBe(false);
    await userEvent.click(nextOnLast);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('navigation layout keeps both arrows mounted and disables the dead end', async () => {
    const onPageChange = vi.fn();
    renderPagination({ layout: 'navigation', currentPage: 1, totalPages: 5, onPageChange });

    // The navigation row is laid out `justify-between`; unmounting a lone arm would
    // teleport the survivor across the bar, so it is disabled-but-visible here too.
    const prev = pageButton('Previous');
    expect(prev.disabled).toBe(true);
    expect(pageButton('Next').disabled).toBe(false);
    await userEvent.click(prev);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('windows long trails with ellipses and First/Last jump buttons', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 10, totalPages: 20, visiblePages: 5, onPageChange });

    // Window centers on the current page: 8–12, an ellipsis on each side.
    expect(screen.getAllByText('...')).toHaveLength(2);
    expect(pageButton('8')).toBeTruthy();
    expect(pageButton('12')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '7' })).toBeNull();
    expect(screen.queryByRole('button', { name: '13' })).toBeNull();

    await userEvent.click(pageButton('First'));
    expect(onPageChange).toHaveBeenLastCalledWith(1);
    await userEvent.click(pageButton('Last'));
    expect(onPageChange).toHaveBeenLastCalledWith(20);
  });

  it('table layout disables Previous on the first page instead of hiding it', async () => {
    const onPageChange = vi.fn();
    renderPagination({ layout: 'table', currentPage: 1, totalPages: 5, onPageChange });

    const prev = pageButton('Previous');
    expect(prev.disabled).toBe(true);
    await userEvent.click(prev);
    expect(onPageChange).not.toHaveBeenCalled();

    await userEvent.click(pageButton('Next'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('a disabled pagination renders inert buttons and never fires onPageChange', async () => {
    const onPageChange = vi.fn();
    renderPagination({ currentPage: 2, totalPages: 5, disabled: true, onPageChange });

    expect(pageButton('4').disabled).toBe(true);
    await userEvent.click(pageButton('4'));
    expect(onPageChange).not.toHaveBeenCalled();
  });
});

// showFirstLast × showNumbers coupling. First/Last are redundancy-gated to the
// number window (they only render beside a start/end ellipsis), so with
// `showNumbers={false}` an explicitly-set `showFirstLast` renders nothing — a
// settled decision (2026-07-14), but its silence was the bug: the component now
// says so in dev, once per instance (fail-loud over silent no-op).
describe('Pagination — showFirstLast without showNumbers (DEV warn)', () => {
  it('warns once when showFirstLast is explicitly set while showNumbers is false, and renders no First/Last', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 5, totalPages: 20, showFirstLast: true, showNumbers: false });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('showFirstLast');
    // The documented coupling holds: no number window → no ellipsis → no First/Last.
    expect(screen.queryByRole('button', { name: 'First' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Last' })).toBeNull();
    warn.mockRestore();
  });

  it('does not re-warn on later prop changes (once per instance)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // `$state` proxy handed to `mount` unspread so prop mutations reach the
    // component (the Collapsible controlled-contract pattern).
    const props = $state<PaginationProps>({
      currentPage: 5,
      totalPages: 20,
      showFirstLast: true,
      showNumbers: false
    });
    const instance = mount(Pagination, { target: document.body, props });
    dispose = () => unmount(instance);
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);

    // Toggling showNumbers on and back off re-runs the effect — the instance
    // flag keeps it at the single initial warn.
    props.showNumbers = true;
    flushSync();
    props.showNumbers = false;
    flushSync();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('stays silent when showFirstLast is left at its default', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 5, totalPages: 20, showNumbers: false });

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('stays silent in the default configuration, where First/Last render beside the ellipsis', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderPagination({ currentPage: 10, totalPages: 20, visiblePages: 5, showFirstLast: true });

    expect(warn).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'First' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Last' })).toBeTruthy();
    warn.mockRestore();
  });
});
